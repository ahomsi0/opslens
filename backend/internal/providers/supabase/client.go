// Package supabase is a minimal client for the Supabase Management API.
// Docs: https://api.supabase.com/api/v1
package supabase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const baseURL = "https://api.supabase.com"

var ErrInvalidToken = errors.New("supabase: invalid or unauthorized token")

type Client struct {
	token      string
	httpClient *http.Client
}

func NewClient(token string) *Client {
	return &Client{
		token:      token,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

type Organization struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// VerifyToken: Supabase doesn't expose a clean /me endpoint, but listing
// orgs proves the PAT is valid and gives us a friendly label.
func (c *Client) VerifyToken(ctx context.Context) (string, error) {
	var orgs []Organization
	if err := c.do(ctx, "GET", "/v1/organizations", &orgs); err != nil {
		return "", err
	}
	if len(orgs) == 0 {
		return "Supabase", nil
	}
	// Return the first org's name as the account label.
	return orgs[0].Name, nil
}

type Project struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organization_id"`
	Name           string `json:"name"`
	Region         string `json:"region"`
	CreatedAt      string `json:"created_at"`
	Status         string `json:"status"`
	Database       struct {
		Host    string `json:"host"`
		Version string `json:"version"`
	} `json:"database"`
}

func (c *Client) ListProjects(ctx context.Context) ([]Project, error) {
	var out []Project
	if err := c.do(ctx, "GET", "/v1/projects", &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) do(ctx context.Context, method, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
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
		return fmt.Errorf("supabase: %s %s -> %s: %s", method, path, resp.Status, string(b))
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}
