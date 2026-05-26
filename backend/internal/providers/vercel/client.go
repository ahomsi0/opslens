// Package vercel is a minimal client for the public Vercel REST API.
// We only implement what Opslens needs: validating a token, listing
// projects, and listing recent deployments per project.
//
// Docs: https://vercel.com/docs/rest-api
package vercel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const baseURL = "https://api.vercel.com"

type Client struct {
	token      string
	teamID     string // optional, for team-scoped tokens
	httpClient *http.Client
}

func NewClient(token string) *Client {
	return &Client{
		token:      token,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// WithTeam scopes the client to a specific team.
func (c *Client) WithTeam(teamID string) *Client {
	c.teamID = teamID
	return c
}

type User struct {
	UID      string `json:"uid"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Name     string `json:"name"`
}

// VerifyToken hits /v2/user. On success returns the authenticated identity.
// On 401/403 returns ErrInvalidToken. Use this to validate user-supplied tokens
// before persisting them.
var ErrInvalidToken = errors.New("vercel: invalid or unauthorized token")

func (c *Client) VerifyToken(ctx context.Context) (*User, error) {
	var resp struct {
		User User `json:"user"`
	}
	if err := c.do(ctx, "GET", "/v2/user", nil, &resp); err != nil {
		return nil, err
	}
	return &resp.User, nil
}

type Project struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AccountID   string `json:"accountId"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
	Framework   string `json:"framework"`
	NodeVersion string `json:"nodeVersion"`
	Link        *struct {
		Type             string `json:"type"`             // 'github' | 'gitlab' | 'bitbucket'
		Repo             string `json:"repo"`             // 'owner/repo'
		Org              string `json:"org"`              // org name
		ProductionBranch string `json:"productionBranch"` // 'main'
	} `json:"link"`
	Targets        map[string]Target `json:"targets,omitempty"`
	LatestDeploy   *LatestDeployment `json:"latestDeployments,omitempty"`
	Alias          []Alias           `json:"alias,omitempty"`
}

type Target struct {
	ID         string `json:"id"`
	URL        string `json:"url"`
	ReadyState string `json:"readyState"`
}

type Alias struct {
	Domain string `json:"domain"`
}

type LatestDeployment struct {
	ID         string `json:"id"`
	URL        string `json:"url"`
	ReadyState string `json:"readyState"`
}

// ListProjects pulls the first page of projects (up to 100).
func (c *Client) ListProjects(ctx context.Context) ([]Project, error) {
	var resp struct {
		Projects []Project `json:"projects"`
	}
	q := url.Values{}
	q.Set("limit", "100")
	if err := c.do(ctx, "GET", "/v9/projects?"+q.Encode(), nil, &resp); err != nil {
		return nil, err
	}
	return resp.Projects, nil
}

type Deployment struct {
	UID        string `json:"uid"`
	Name       string `json:"name"`
	URL        string `json:"url"`
	State      string `json:"state"`      // QUEUED | BUILDING | READY | ERROR | CANCELED
	ReadyState string `json:"readyState"` // same values as State
	Type       string `json:"type"`
	Created    int64  `json:"created"`
	ReadyAt    int64  `json:"ready"`
	BuildingAt int64  `json:"buildingAt"`
	Target     string `json:"target"` // 'production' or empty
	Creator    struct {
		Username string `json:"username"`
		Email    string `json:"email"`
	} `json:"creator"`
	Meta struct {
		GithubCommitSha     string `json:"githubCommitSha"`
		GithubCommitMessage string `json:"githubCommitMessage"`
		GithubCommitRef     string `json:"githubCommitRef"`
		GithubCommitAuthor  string `json:"githubCommitAuthorLogin"`
		// Vercel also provides gitlab*/bitbucket* equivalents — left out for brevity.
	} `json:"meta"`
}

// ListDeployments returns the most recent deployments for a project.
func (c *Client) ListDeployments(ctx context.Context, projectID string, limit int) ([]Deployment, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	q := url.Values{}
	q.Set("projectId", projectID)
	q.Set("limit", fmt.Sprintf("%d", limit))
	var resp struct {
		Deployments []Deployment `json:"deployments"`
	}
	if err := c.do(ctx, "GET", "/v6/deployments?"+q.Encode(), nil, &resp); err != nil {
		return nil, err
	}
	return resp.Deployments, nil
}

// do is the low-level request helper. Always JSON, always bearer-auth.
func (c *Client) do(ctx context.Context, method, path string, body io.Reader, out any) error {
	if c.teamID != "" {
		sep := "?"
		if containsRune(path, '?') {
			sep = "&"
		}
		path = path + sep + "teamId=" + url.QueryEscape(c.teamID)
	}
	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return ErrInvalidToken
	}
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return fmt.Errorf("vercel: %s %s -> %s: %s", method, path, resp.Status, string(b))
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

func containsRune(s string, r rune) bool {
	for _, c := range s {
		if c == r {
			return true
		}
	}
	return false
}
