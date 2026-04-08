export interface ZSkySubmitResponse {
  job_id: string;
  status: string;
  type: string;
  worker: string;
  poll_url: string;
  credit_cost: number;
  tier: string;
  priority: number;
}

export interface ZSkyPollResponse {
  job_id: string;
  status: 'queued' | 'generating' | 'completed' | 'failed' | 'error';
  type: string;
  worker: string;
  created: number;
  elapsed: number;
  progress: number;
  priority: number;
  queue_type?: string;
  queue_position?: number;
  estimated_wait?: number;
  paid_wait?: number;
  results?: ZSkyResult[];
}

export interface ZSkyResult {
  id: string;
  filename: string;
  size_bytes: number;
  url: string;
  base64: string | null;
  content_type: string;
  worker: string;
}
