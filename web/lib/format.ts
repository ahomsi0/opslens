export function formatNumber(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", opts).format(n);
}

export function formatPercent(n: number, digits = 2) {
  return `${n.toFixed(digits)}%`;
}

export function formatMs(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${Math.round(n)}ms`;
}

export function formatBytes(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${mb.toFixed(0)}MB`;
}

export function formatNetRate(mbps: number) {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)}Gb/s`;
  return `${mbps.toFixed(0)}Mb/s`;
}

export function timeAgo(iso: string) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function shortSha(sha: string) {
  return sha.slice(0, 7);
}
