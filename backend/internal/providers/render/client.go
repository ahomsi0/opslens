// Package render is a minimal client for the Render REST API.
// Only the endpoints Opslens needs: validating a token, listing services
// (one per "project" in our model), and listing recent deploys per service.
//
// Docs: https://api-docs.render.com
package render

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

const baseURL = "https://api.render.com/v1"

var ErrInvalidToken = errors.New("render: invalid or unauthorized token")

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

type Owner struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Type  string `json:"type"`
}

// Render wraps list-endpoint responses in an envelope: each element is
// {"owner": {...}, "cursor": "..."} or {"service": {...}, "cursor": "..."}.
type ownerEnvelope struct {
	Owner  Owner  `json:"owner"`
	Cursor string `json:"cursor"`
}

type serviceEnvelope struct {
	Service Service `json:"service"`
	Cursor  string  `json:"cursor"`
}

type deployEnvelope struct {
	Deploy Deploy `json:"deploy"`
	Cursor string `json:"cursor"`
}

// VerifyToken hits /v1/owners. Returns the first owner the token can see.
// On 401/403 returns ErrInvalidToken.
func (c *Client) VerifyToken(ctx context.Context) (*Owner, error) {
	var out []ownerEnvelope
	if err := c.do(ctx, "GET", "/owners?limit=1", &out); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, errors.New("render: no owners visible to this token")
	}
	return &out[0].Owner, nil
}

type Service struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	OwnerID        string         `json:"ownerId"`
	Type           string         `json:"type"` // web_service | static_site | background_worker | cron_job | private_service | redis | postgres
	Repo           string         `json:"repo"`
	Branch         string         `json:"branch"`
	AutoDeploy     string         `json:"autoDeploy"`
	Suspended      string         `json:"suspended"` // 'not_suspended' | 'suspended'
	CreatedAt      string         `json:"createdAt"`
	UpdatedAt      string         `json:"updatedAt"`
	ServiceDetails ServiceDetails `json:"serviceDetails"`
}

type ServiceDetails struct {
	URL    string `json:"url"`
	Region string `json:"region"`
	Plan   string `json:"plan"`
	Env    string `json:"env"`
}

// ListServices pulls services for the authenticated account, up to limit.
func (c *Client) ListServices(ctx context.Context, limit int) ([]Service, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	q := url.Values{}
	q.Set("limit", fmt.Sprintf("%d", limit))
	var envelopes []serviceEnvelope
	if err := c.do(ctx, "GET", "/services?"+q.Encode(), &envelopes); err != nil {
		return nil, err
	}
	out := make([]Service, 0, len(envelopes))
	for _, e := range envelopes {
		out = append(out, e.Service)
	}
	return out, nil
}

type Deploy struct {
	ID         string  `json:"id"`
	Commit     *Commit `json:"commit"`
	Status     string  `json:"status"`     // 'live' | 'build_failed' | 'update_failed' | 'created' | 'build_in_progress' | 'update_in_progress' | 'canceled' | 'deactivated'
	Trigger    string  `json:"trigger"`    // 'new_commit' | 'manual' | etc
	CreatedAt  string  `json:"createdAt"`
	FinishedAt string  `json:"finishedAt"`
}

type Commit struct {
	ID      string `json:"id"`
	Message string `json:"message"`
}

// ListDeploys returns recent deploys for a service.
func (c *Client) ListDeploys(ctx context.Context, serviceID string, limit int) ([]Deploy, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	q := url.Values{}
	q.Set("limit", fmt.Sprintf("%d", limit))
	var envelopes []deployEnvelope
	if err := c.do(ctx, "GET", "/services/"+serviceID+"/deploys?"+q.Encode(), &envelopes); err != nil {
		return nil, err
	}
	out := make([]Deploy, 0, len(envelopes))
	for _, e := range envelopes {
		out = append(out, e.Deploy)
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
		return fmt.Errorf("render: %s %s -> %s: %s", method, path, resp.Status, string(b))
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}
