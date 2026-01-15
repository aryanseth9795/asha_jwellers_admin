// BhavService.ts - API service for managing static bhav rates

const BASE_URL = "https://ssj-server.onrender.com";
const ADMIN_KEY = "ayushseth958";

export interface BhavValue {
  value: number;
  updated_at: string;
}

export interface BhavData {
  silver_bhav: BhavValue;
  gold_995_bhav: BhavValue;
  gold_999_bhav: BhavValue;
  rtgs_bhav: BhavValue;
}

export interface GetBhavResponse {
  data: BhavData;
  validKeys: string[];
}

export interface UpdateBhavPayload {
  silver_bhav?: number;
  gold_995_bhav?: number;
  gold_999_bhav?: number;
  rtgs_bhav?: number;
}

export interface UpdateBhavResponse {
  message: string;
  data: BhavData;
}

/**
 * Fetch all current static bhav rates
 */
export const getBhavRates = async (): Promise<GetBhavResponse> => {
  const response = await fetch(`${BASE_URL}/api/admin/static`, {
    method: "GET",
    headers: {
    //   "x-admin-key": ADMIN_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch bhav rates: ${response.status}`);
  }

  return response.json();
};

/**
 * Update multiple bhav rates at once
 */
export const updateBhavRates = async (
  payload: UpdateBhavPayload
): Promise<UpdateBhavResponse> => {
  const response = await fetch(`${BASE_URL}/api/admin/static`, {
    method: "PUT",
    headers: {
      "x-admin-key": ADMIN_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update bhav rates: ${response.status}`);
  }

  return response.json();
};
