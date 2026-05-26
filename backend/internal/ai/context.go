// Package ai builds the "what does the assistant know about the user's
// infrastructure" payload that gets injected into every chat request.
// It pulls real projects, recent deploys, and incident counts from the
// DB — no hallucinations about services we can't see.
package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahomsi0/opslens/backend/internal/db"
)

// BuildSystemPrompt produces the system message for a chat request.
// If projectID is non-zero, that project's recent deploys + error logs
// are included as a focused detail block.
func BuildSystemPrompt(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID) (string, error) {
	projects, err := db.ListProjects(ctx, pool)
	if err != nil {
		return "", err
	}

	var b strings.Builder
	b.WriteString(`You are Opslens AI, an assistant embedded in an infrastructure monitoring dashboard for a developer.
You have access to the user's connected services (Vercel, Render, Neon, etc.) and their recent deploy history.

Rules:
- Answer in plain English. Be concise. No corporate fluff.
- Use the data below — do NOT invent metrics, project names, or services you can't see in this prompt.
- If the user asks something you don't have data for, say so honestly.
- When asked "why" something happened, look at recent deploys for clues (timing, commit messages).
- Format with light markdown: **bold**, ` + "`code`" + `, fenced blocks, bullet lists. No headers.
- Keep answers under ~150 words unless the user explicitly asks for more.

`)

	b.WriteString("# Workspace snapshot\n\n")
	if len(projects) == 0 {
		b.WriteString("The user has no projects connected yet. Suggest they go to Integrations and connect Vercel or Render.\n")
		return b.String(), nil
	}

	healthy, degraded, down := 0, 0, 0
	for _, p := range projects {
		switch p.Status {
		case "healthy":
			healthy++
		case "degraded":
			degraded++
		case "down":
			down++
		}
	}
	fmt.Fprintf(&b, "- %d projects total (%d healthy, %d degraded, %d down)\n", len(projects), healthy, degraded, down)
	fmt.Fprintln(&b)

	b.WriteString("## Projects\n\n")
	for _, p := range projects {
		fmt.Fprintf(&b, "- **%s** — %s · %s · %s · status: %s · domain: %s\n",
			p.Name, p.Provider, p.Environment, p.Region, p.Status, p.Domain)
		// Latest deploy line
		if last, _ := db.LatestDeployment(ctx, pool, p.ID); last != nil {
			fmt.Fprintf(&b, "  - latest deploy: %s `%s` \"%s\" by %s (%s)\n",
				last.Status, shorten(last.CommitSHA, 7), last.CommitMsg, last.Author, p.Provider)
		}
	}
	b.WriteString("\n")

	// Focused detail when the user is viewing a specific project
	if projectID != uuid.Nil {
		focused, err := db.GetProject(ctx, pool, projectID)
		if err == nil && focused != nil {
			fmt.Fprintf(&b, "# Focus: %s\n\n", focused.Name)
			fmt.Fprintf(&b, "User is currently viewing this project. Prioritize answering about it specifically.\n\n")
			deps, _ := db.ListDeployments(ctx, pool, projectID, 8)
			if len(deps) > 0 {
				b.WriteString("Recent deploys:\n")
				for _, d := range deps {
					fmt.Fprintf(&b, "- %s `%s` \"%s\" by %s (%dms build)\n",
						d.Status, shorten(d.CommitSHA, 7), d.CommitMsg, d.Author, d.DurationMs)
				}
				b.WriteString("\n")
			}
			// Last 10 error logs if any
			logs, _ := db.ListLogs(ctx, pool, projectID, db.LogFilter{
				Levels: []string{"error"},
				Limit:  10,
			})
			if len(logs) > 0 {
				b.WriteString("Recent errors:\n")
				for _, l := range logs {
					fmt.Fprintf(&b, "- [%s] %s: %s\n", l.Source, l.CreatedAt.Format("15:04:05"), l.Message)
				}
				b.WriteString("\n")
			}
		}
	}

	return b.String(), nil
}

func shorten(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
