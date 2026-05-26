// Minimal GitHub OAuth (Authorization Code flow, no PKCE — server-side only).
//
// Required env:
//   GITHUB_CLIENT_ID
//   GITHUB_CLIENT_SECRET
//   OAUTH_CALLBACK_URL  (e.g. https://opslens-api.onrender.com/api/auth/github/callback)
//   FRONTEND_URL        (e.g. https://opslens.vercel.app — where to redirect after success)
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

func GithubConfigured() bool {
	return os.Getenv("GITHUB_CLIENT_ID") != "" && os.Getenv("GITHUB_CLIENT_SECRET") != ""
}

func GithubAuthorizeURL(state string) string {
	q := url.Values{}
	q.Set("client_id", os.Getenv("GITHUB_CLIENT_ID"))
	q.Set("redirect_uri", os.Getenv("OAUTH_CALLBACK_URL"))
	q.Set("scope", "read:user user:email")
	q.Set("state", state)
	q.Set("allow_signup", "true")
	return "https://github.com/login/oauth/authorize?" + q.Encode()
}

type GithubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

type GithubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

// GithubExchange swaps a callback code for an access token, then fetches the
// user's profile (and primary email if not public). Returns enough to either
// match an existing user (by github_id) or create one.
func GithubExchange(ctx context.Context, code string) (*GithubUser, error) {
	form := url.Values{}
	form.Set("client_id", os.Getenv("GITHUB_CLIENT_ID"))
	form.Set("client_secret", os.Getenv("GITHUB_CLIENT_SECRET"))
	form.Set("code", code)
	form.Set("redirect_uri", os.Getenv("OAUTH_CALLBACK_URL"))

	req, _ := http.NewRequestWithContext(ctx, "POST",
		"https://github.com/login/oauth/access_token",
		strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token exchange: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("token decode: %w", err)
	}
	if tokenResp.Error != "" {
		return nil, fmt.Errorf("github: %s — %s", tokenResp.Error, tokenResp.ErrorDesc)
	}
	if tokenResp.AccessToken == "" {
		return nil, errors.New("github: empty access token")
	}

	// Fetch the user
	user, err := fetchGithubUser(ctx, tokenResp.AccessToken)
	if err != nil {
		return nil, err
	}
	// Some users have private emails on the /user endpoint; backfill from /user/emails.
	if user.Email == "" {
		email, err := fetchGithubPrimaryEmail(ctx, tokenResp.AccessToken)
		if err == nil {
			user.Email = email
		}
	}
	if user.Name == "" {
		user.Name = user.Login
	}
	return user, nil
}

func fetchGithubUser(ctx context.Context, token string) (*GithubUser, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github /user: %s", resp.Status)
	}
	var u GithubUser
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return nil, err
	}
	return &u, nil
}

func fetchGithubPrimaryEmail(ctx context.Context, token string) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/emails", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("github /user/emails: %s", resp.Status)
	}
	var emails []GithubEmail
	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return "", err
	}
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, nil
		}
	}
	for _, e := range emails {
		if e.Verified {
			return e.Email, nil
		}
	}
	return "", errors.New("no verified email")
}
