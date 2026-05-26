// Package crypto provides symmetric encryption for secrets at rest.
// Tokens stored in the DB are sealed with AES-256-GCM using a single
// app-wide key. Each ciphertext has its 12-byte nonce prepended.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
)

const KeyEnv = "ENCRYPTION_KEY"

// Sealer holds an initialized AEAD ready to encrypt/decrypt.
type Sealer struct {
	aead cipher.AEAD
}

// New returns a Sealer using the key found in the ENCRYPTION_KEY env var.
// The key must be 32 bytes, base64-encoded. If absent, a stable dev key is used —
// fine for local development but unsuitable for production.
func New() (*Sealer, error) {
	keyB64 := os.Getenv(KeyEnv)
	if keyB64 == "" {
		// Stable 32-byte dev fallback so connections persist across restarts in
		// local dev. In production, set ENCRYPTION_KEY to a base64-encoded
		// 32-byte value (e.g. `openssl rand -base64 32`).
		keyB64 = "cHVsc2VzdGFjay1kZXYta2V5LTMyLWJ5dGVzLWxvbmc="
	}
	key, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil {
		return nil, fmt.Errorf("ENCRYPTION_KEY is not valid base64: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("ENCRYPTION_KEY must decode to 32 bytes (got %d)", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Sealer{aead: aead}, nil
}

// Encrypt seals plaintext. Returned bytes are [nonce || ciphertext || tag].
func (s *Sealer) Encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	out := s.aead.Seal(nonce, nonce, plaintext, nil)
	return out, nil
}

// Decrypt opens a sealed value produced by Encrypt.
func (s *Sealer) Decrypt(sealed []byte) ([]byte, error) {
	ns := s.aead.NonceSize()
	if len(sealed) < ns {
		return nil, errors.New("ciphertext too short")
	}
	nonce, ct := sealed[:ns], sealed[ns:]
	return s.aead.Open(nil, nonce, ct, nil)
}

// EncryptString is a convenience wrapper.
func (s *Sealer) EncryptString(plain string) ([]byte, error) {
	return s.Encrypt([]byte(plain))
}

// DecryptString is a convenience wrapper.
func (s *Sealer) DecryptString(sealed []byte) (string, error) {
	out, err := s.Decrypt(sealed)
	if err != nil {
		return "", err
	}
	return string(out), nil
}
