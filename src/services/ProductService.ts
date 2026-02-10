// ProductService.ts - API service for managing products and categories

const BASE_URL = "https://ssj-server-om8r.onrender.com";
const ADMIN_KEY = "ayushseth958";

// ============ TYPES ============

export interface Category {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  image?: any; // File object or URI string
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string;
  image?: any; // File object or URI string
}

export interface Variant {
  _id: string;
  size?: string;
  weight?: string;
  images?: string[];
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  category: {
    _id: string;
    name: string;
  };
  variants: Variant[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  thumbnail?: any; // File object or URI string
  category: string; // Category ObjectId
  variantWeight: string; // Required — weight for the first variant
  variantSize?: string; // Optional — size for the first variant
  variantImages?: any[]; // Optional — images for the first variant (up to 10)
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  thumbnail?: any;
  category?: string;
}

export interface CreateVariantPayload {
  weight: string; // Required
  size?: string;
  images?: any[];
}

export interface UpdateVariantPayload {
  weight: string; // Required
  size?: string;
  existingImages?: string[]; // JSON array of existing image URLs to keep
  images?: any[]; // New images to add
}

// ============ API RESPONSE TYPES ============

interface CategoryListResponse {
  data: Category[];
}

interface CategoryResponse {
  data: Category;
}

interface CategoryMutationResponse {
  message: string;
  data: Category;
}

interface ProductListResponse {
  data: Product[];
}

interface ProductResponse {
  data: Product;
}

interface ProductMutationResponse {
  message: string;
  data: Product;
}

// Helper to create FormData
const createFormData = (payload: any) => {
  const formData = new FormData();

  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (value === undefined || value === null) return;

    if ((key === "variantImages" || key === "images") && Array.isArray(value)) {
      // Multiple file fields — append each file individually under the same key
      value.forEach((img: any, index: number) => {
        if (typeof img === "object" && img.uri) {
          formData.append(key, {
            uri: img.uri,
            name: img.fileName || `image_${index}.jpg`,
            type: img.type || "image/jpeg",
          } as any);
        }
      });
    } else if (
      (key === "image" || key === "thumbnail") &&
      typeof value === "object" &&
      value.uri
    ) {
      formData.append(key, {
        uri: value.uri,
        name: value.fileName || "image.jpg",
        type: value.type || "image/jpeg",
      } as any);
    } else if (key === "existingImages" && Array.isArray(value)) {
      // Send existing image URLs as JSON string
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, value);
    }
  });

  return formData;
};

// ============ CATEGORY API ============

/**
 * Fetch all categories (public)
 */
export const getCategories = async (): Promise<CategoryListResponse> => {
  const response = await fetch(`${BASE_URL}/api/categories`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to fetch categories: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Fetch single category by ID (public)
 */
export const getCategoryById = async (
  id: string,
): Promise<CategoryResponse> => {
  const response = await fetch(`${BASE_URL}/api/categories/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to fetch category: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Create a new category (admin)
 */
export const createCategory = async (
  payload: CreateCategoryPayload,
): Promise<CategoryMutationResponse> => {
  // Check if we need multipart
  const isMultipart =
    payload.image && typeof payload.image === "object" && payload.image.uri;

  let body;
  let headers: HeadersInit = {
    "x-admin-key": ADMIN_KEY,
  };

  if (isMultipart) {
    body = createFormData(payload);
    // Content-Type header should be left undefined for FormData to set boundary
  } else {
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}/api/categories`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to create category: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Update an existing category (admin)
 */
export const updateCategory = async (
  id: string,
  payload: UpdateCategoryPayload,
): Promise<CategoryMutationResponse> => {
  const isMultipart =
    payload.image && typeof payload.image === "object" && payload.image.uri;

  let body;
  let headers: HeadersInit = {
    "x-admin-key": ADMIN_KEY,
  };

  if (isMultipart) {
    body = createFormData(payload);
  } else {
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}/api/categories/${id}`, {
    method: "PUT",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to update category: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Delete a category (admin)
 */
export const deleteCategory = async (
  id: string,
): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/api/categories/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to delete category: ${response.status}`,
    );
  }

  return response.json();
};

// ============ PRODUCT API ============

/**
 * Fetch all products (public)
 */
export const getProducts = async (
  categoryId?: string,
): Promise<ProductListResponse> => {
  const url = categoryId
    ? `${BASE_URL}/api/products?category=${categoryId}`
    : `${BASE_URL}/api/products`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to fetch products: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Fetch products by category (public)
 */
export const getProductsByCategory = async (
  categoryId: string,
): Promise<ProductListResponse> => {
  const response = await fetch(
    `${BASE_URL}/api/products/by-category/${categoryId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to fetch products: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Fetch single product by ID (public)
 */
export const getProductById = async (id: string): Promise<ProductResponse> => {
  const response = await fetch(`${BASE_URL}/api/products/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to fetch product: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Create a new product with its first variant (admin)
 * Always uses multipart/form-data to support file uploads.
 */
export const createProduct = async (
  payload: CreateProductPayload,
): Promise<ProductMutationResponse> => {
  const body = createFormData(payload);
  const headers: HeadersInit = {
    "x-admin-key": ADMIN_KEY,
  };

  const response = await fetch(`${BASE_URL}/api/products`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to create product: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Update an existing product's details (admin)
 * Updates product-level fields only (not variants).
 */
export const updateProduct = async (
  id: string,
  payload: UpdateProductPayload,
): Promise<ProductMutationResponse> => {
  const hasFile =
    payload.thumbnail &&
    typeof payload.thumbnail === "object" &&
    payload.thumbnail.uri;

  let body;
  let headers: HeadersInit = {
    "x-admin-key": ADMIN_KEY,
  };

  if (hasFile) {
    body = createFormData(payload);
  } else {
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}/api/products/${id}`, {
    method: "PUT",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to update product: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Delete a product (admin)
 */
export const deleteProduct = async (
  id: string,
): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/api/products/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to delete product: ${response.status}`,
    );
  }

  return response.json();
};

// ============ VARIANT API ============

/**
 * Add a variant to a product (admin)
 */
export const addVariant = async (
  productId: string,
  payload: CreateVariantPayload,
): Promise<ProductMutationResponse> => {
  const hasFiles =
    payload.images && payload.images.some((img) => typeof img === "object");

  let body;
  let headers: HeadersInit = {
    "x-admin-key": ADMIN_KEY,
  };

  if (hasFiles) {
    body = createFormData(payload);
  } else {
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(
    `${BASE_URL}/api/products/${productId}/variants`,
    {
      method: "POST",
      headers,
      body,
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to add variant: ${response.status}`);
  }

  return response.json();
};

/**
 * Update a variant (admin)
 * Supports existingImages (URLs to keep) + new images (files to upload).
 */
export const updateVariant = async (
  productId: string,
  variantId: string,
  payload: UpdateVariantPayload,
): Promise<ProductMutationResponse> => {
  const hasFiles =
    payload.images &&
    payload.images.some((img: any) => typeof img === "object");
  const hasExistingImages =
    payload.existingImages && payload.existingImages.length > 0;

  let body;
  let headers: HeadersInit = {
    "x-admin-key": ADMIN_KEY,
  };

  if (hasFiles || hasExistingImages) {
    body = createFormData(payload);
  } else {
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(
    `${BASE_URL}/api/products/${productId}/variants/${variantId}`,
    {
      method: "PUT",
      headers,
      body,
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to update variant: ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Delete a variant (admin)
 */
export const deleteVariant = async (
  productId: string,
  variantId: string,
): Promise<ProductMutationResponse> => {
  const response = await fetch(
    `${BASE_URL}/api/products/${productId}/variants/${variantId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": ADMIN_KEY,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Failed to delete variant: ${response.status}`,
    );
  }

  return response.json();
};
