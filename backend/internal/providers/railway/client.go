// Package railway is a minimal GraphQL client for the Railway public API.
// Docs: https://docs.railway.com/reference/public-api
package railway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const baseURL = "https://backboard.railway.com/graphql/v2"

var ErrInvalidToken = errors.New("railway: invalid or unauthorized token")

type Client struct {
	token      string
	httpClient *http.Client
}

func NewClient(token string) *Client {
	return &Client{
		token:      token,
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func (c *Client) VerifyToken(ctx context.Context) (*User, error) {
	var resp struct {
		Me User `json:"me"`
	}
	q := `query { me { id email name } }`
	if err := c.gql(ctx, q, nil, &resp); err != nil {
		return nil, err
	}
	return &resp.Me, nil
}

type Project struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
	Services  struct {
		Edges []struct {
			Node Service `json:"node"`
		} `json:"edges"`
	} `json:"services"`
}

type Service struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	CreatedAt  string `json:"createdAt"`
	Deployments struct {
		Edges []struct {
			Node Deployment `json:"node"`
		} `json:"edges"`
	} `json:"deployments"`
}

type Deployment struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
	StaticUrl string `json:"staticUrl"`
	Meta      struct {
		CommitMessage string `json:"commitMessage"`
		CommitHash    string `json:"commitHash"`
		CommitAuthor  string `json:"commitAuthor"`
		Branch        string `json:"branch"`
	} `json:"meta"`
}

func (c *Client) ListProjects(ctx context.Context) ([]Project, error) {
	q := `query {
		projects {
			edges {
				node {
					id
					name
					createdAt
					services {
						edges {
							node {
								id
								name
								createdAt
								deployments(first: 10) {
									edges {
										node {
											id
											status
											createdAt
											staticUrl
											meta
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}`
	var resp struct {
		Projects struct {
			Edges []struct {
				Node Project `json:"node"`
			} `json:"edges"`
		} `json:"projects"`
	}
	if err := c.gql(ctx, q, nil, &resp); err != nil {
		return nil, err
	}
	out := make([]Project, 0, len(resp.Projects.Edges))
	for _, e := range resp.Projects.Edges {
		out = append(out, e.Node)
	}
	return out, nil
}

func (c *Client) gql(ctx context.Context, query string, variables map[string]any, out any) error {
	body, _ := json.Marshal(map[string]any{
		"query":     query,
		"variables": variables,
	})
	req, err := http.NewRequestWithContext(ctx, "POST", baseURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

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
		return fmt.Errorf("railway: %s: %s", resp.Status, string(b))
	}

	// GraphQL puts errors in the body with a 200 status, so parse the envelope.
	var envelope struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return err
	}
	if len(envelope.Errors) > 0 {
		msgs := make([]string, 0, len(envelope.Errors))
		for _, e := range envelope.Errors {
			msgs = append(msgs, e.Message)
		}
		// Railway returns "Not Authorized" for invalid tokens within a 200 body.
		joined := join(msgs, "; ")
		if contains(joined, "Not Authorized") || contains(joined, "Unauthorized") {
			return ErrInvalidToken
		}
		return fmt.Errorf("railway graphql: %s", joined)
	}
	if out != nil {
		return json.Unmarshal(envelope.Data, out)
	}
	return nil
}

func join(xs []string, sep string) string {
	if len(xs) == 0 {
		return ""
	}
	s := xs[0]
	for i := 1; i < len(xs); i++ {
		s += sep + xs[i]
	}
	return s
}

func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (haystack == needle || indexOf(haystack, needle) >= 0)
}

func indexOf(haystack, needle string) int {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}
