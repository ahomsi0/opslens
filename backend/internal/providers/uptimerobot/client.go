// Package uptimerobot is a minimal client for the UptimeRobot REST API.
// Their API is unusual: every endpoint is POST with form-encoded body.
//
// Docs: https://uptimerobot.com/api/
package uptimerobot

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const baseURL = "https://api.uptimerobot.com/v2"

var ErrInvalidToken = errors.New("uptimerobot: invalid or unauthorized API key")

type Client struct {
	apiKey     string
	httpClient *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

type Account struct {
	Email             string `json:"email"`
	UpMonitors        int    `json:"up_monitors"`
	DownMonitors      int    `json:"down_monitors"`
	PausedMonitors    int    `json:"paused_monitors"`
}

// VerifyToken hits /getAccountDetails. Returns the account's email on success.
func (c *Client) VerifyToken(ctx context.Context) (*Account, error) {
	var resp struct {
		Stat    string  `json:"stat"`
		Error   *struct {
			Message string `json:"message"`
			Type    string `json:"type"`
		} `json:"error"`
		Account Account `json:"account"`
	}
	if err := c.do(ctx, "/getAccountDetails", nil, &resp); err != nil {
		return nil, err
	}
	if resp.Stat != "ok" {
		if resp.Error != nil && (strings.Contains(resp.Error.Type, "api_key") || strings.Contains(resp.Error.Message, "api_key")) {
			return nil, ErrInvalidToken
		}
		return nil, fmt.Errorf("uptimerobot: %v", resp.Error)
	}
	return &resp.Account, nil
}

// Status codes used by UptimeRobot. We map onto our 3-state model in sync.go.
const (
	MonitorPaused   = 0
	MonitorNotYet   = 1
	MonitorUp       = 2
	MonitorSeemDown = 8
	MonitorDown     = 9
)

type Monitor struct {
	ID                int     `json:"id"`
	FriendlyName      string  `json:"friendly_name"`
	URL               string  `json:"url"`
	Type              int     `json:"type"` // 1=HTTP, 2=Keyword, 3=Ping, 4=Port
	Status            int     `json:"status"`
	CreateDatetime    int64   `json:"create_datetime"`
	CustomUptimeRatio string  `json:"custom_uptime_ratio"`
}

// ListMonitors pulls up to 50 monitors (their default page). custom_uptime_ratios
// asks for the 1/7/30-day percentages joined with commas, so we can surface
// real uptime without doing our own probe math.
func (c *Client) ListMonitors(ctx context.Context) ([]Monitor, error) {
	body := url.Values{}
	body.Set("custom_uptime_ratios", "1-7-30")
	body.Set("response_times", "0")
	var resp struct {
		Stat     string    `json:"stat"`
		Error    any       `json:"error"`
		Monitors []Monitor `json:"monitors"`
	}
	if err := c.do(ctx, "/getMonitors", body, &resp); err != nil {
		return nil, err
	}
	if resp.Stat != "ok" {
		return nil, fmt.Errorf("uptimerobot getMonitors: %v", resp.Error)
	}
	return resp.Monitors, nil
}

func (c *Client) do(ctx context.Context, path string, body url.Values, out any) error {
	if body == nil {
		body = url.Values{}
	}
	body.Set("api_key", c.apiKey)
	body.Set("format", "json")

	req, err := http.NewRequestWithContext(ctx, "POST", baseURL+path, strings.NewReader(body.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Cache-Control", "no-cache")

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
		return fmt.Errorf("uptimerobot %s -> %s: %s", path, resp.Status, string(b))
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}
