// Package neon is a minimal client for Neon's REST API.
// Docs: https://api-docs.neon.tech
package neon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const baseURL = "https://console.neon.tech/api/v2"

var ErrInvalidToken = errors.New("neon: invalid or unauthorized token")

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

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Login string `json:"login"`
}

func (c *Client) VerifyToken(ctx context.Context) (*User, error) {
	var out User
	if err := c.do(ctx, "GET", "/users/me", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

type Project struct {
	ID                  string `json:"id"`
	PlatformID          string `json:"platform_id"`
	RegionID            string `json:"region_id"`
	Name                string `json:"name"`
	PGVersion           int    `json:"pg_version"`
	CreatedAt           string `json:"created_at"`
	UpdatedAt           string `json:"updated_at"`
	ComputeLastActiveAt string `json:"compute_last_active_at"`
}

func (c *Client) ListProjects(ctx context.Context) ([]Project, error) {
	var resp struct {
		Projects []Project `json:"projects"`
	}
	if err := c.do(ctx, "GET", "/projects?limit=100", &resp); err != nil {
		return nil, err
	}
	return resp.Projects, nil
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
		return fmt.Errorf("neon: %s %s -> %s: %s", method, path, resp.Status, string(b))
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}
