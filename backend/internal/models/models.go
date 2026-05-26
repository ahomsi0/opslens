package models

import (
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID           uuid.UUID  `json:"id"`
	Name         string     `json:"name"`
	Slug         string     `json:"slug"`
	Provider     string     `json:"provider"`
	Environment  string     `json:"environment"`
	Region       string     `json:"region"`
	RepoURL      string     `json:"repoUrl"`
	Domain       string     `json:"domain"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"createdAt"`
	Source       string     `json:"source"`       // 'demo' | 'vercel' | ...
	ConnectionID *uuid.UUID `json:"connectionId,omitempty"`
	ExternalID   *string    `json:"externalId,omitempty"`
	LiveMetrics  bool       `json:"liveMetrics"`
}

type ProjectSummary struct {
	Project
	UptimePct       float64       `json:"uptimePct"`
	LatencyP95Ms    int           `json:"latencyP95Ms"`
	LastDeployment  *Deployment   `json:"lastDeployment,omitempty"`
	LatencySpark    []int         `json:"latencySpark"`
	ActiveIncidents int           `json:"activeIncidents"`
}

type Deployment struct {
	ID         uuid.UUID `json:"id"`
	ProjectID  uuid.UUID `json:"projectId"`
	Status     string    `json:"status"`
	CommitSHA  string    `json:"commitSha"`
	CommitMsg  string    `json:"commitMsg"`
	Author     string    `json:"author"`
	Branch     string    `json:"branch"`
	DurationMs int       `json:"durationMs"`
	CreatedAt  time.Time `json:"createdAt"`
}

type LogEntry struct {
	ID        int64     `json:"id"`
	ProjectID uuid.UUID `json:"projectId"`
	Level     string    `json:"level"`
	Source    string    `json:"source"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}

type MetricFrame struct {
	Type      string    `json:"type"`
	ProjectID uuid.UUID `json:"projectId"`
	Ts        time.Time `json:"ts"`
	CPU       float64   `json:"cpu"`
	Memory    float64   `json:"memory"`
	NetIn     float64   `json:"netIn"`
	NetOut    float64   `json:"netOut"`
	LatencyMs float64   `json:"latencyMs"`
	RPS       float64   `json:"rps"`
	Status    string    `json:"status"`
}
