# Admin Product & Category API Documentation

This document describes the API routes for product and category management.

> [!IMPORTANT]
> **Image Upload**: All endpoints that involve image creation/updates accept **`multipart/form-data`**. Images should be sent as files — the server uploads them to Cloudinary and stores the returned URLs in MongoDB.

---

## 🔐 Authentication

All **admin routes** require the `x-admin-key` header:

```http
x-admin-key: YOUR_ADMIN_API_KEY
```

---

## 📦 Category Routes

Base URL: `/api/categories`

### Data Model

```typescript
interface Category {
  _id: string;
  name: string;
  description?: string;
  image?: string; // Cloudinary URL (returned in response)
}
```

### Public Routes

#### GET `/api/categories` — List All Categories

_Returns JSON list of categories sorted by name._

#### GET `/api/categories/:id` — Get Single Category

---

### Admin Routes (Require `x-admin-key`)

#### POST `/api/categories` — Create Category

**Content-Type:** `multipart/form-data`

| Field         | Type | Description                            |
| ------------- | ---- | -------------------------------------- |
| `name`        | Text | **Required**. 1-100 chars.             |
| `description` | Text | Optional. Max 500 chars.               |
| `image`       | File | Optional. Image file (jpg, png, webp). |

#### PUT `/api/categories/:id` — Update Category

**Content-Type:** `multipart/form-data`

| Field         | Type | Description                        |
| ------------- | ---- | ---------------------------------- |
| `name`        | Text | Optional.                          |
| `description` | Text | Optional.                          |
| `image`       | File | Optional. Replaces existing image. |

#### DELETE `/api/categories/:id` — Delete Category

---

## 🛍️ Product Routes

Base URL: `/api/products`

### Data Model

```typescript
interface IVariant {
  _id: string;
  weight?: string;
  size?: string;
  images?: string[]; // Cloudinary URLs
}

interface IProduct {
  _id: string;
  name: string;
  description?: string;
  thumbnail?: string; // Cloudinary URL
  category: { _id: string; name: string };
  variants: IVariant[]; // At least 1 variant required
  createdAt: string;
  updatedAt: string;
}
```

> [!NOTE]
> Products no longer have top-level `images`, `weight`, or `size` fields. All of these are now part of **variants**. Every product must have at least one variant.

### Public Routes

#### GET `/api/products` — List All Products

Optional query: `?category=<categoryId>`

#### GET `/api/products/by-category/:categoryId` — Products in Category

#### GET `/api/products/:id` — Product Details (with variants)

---

### Admin Routes (Require `x-admin-key`)

#### POST `/api/products` — Create Product (with first variant)

**Content-Type:** `multipart/form-data`

Creates a product with its first mandatory variant in one request.

| Field           | Type   | Description                                        |
| --------------- | ------ | -------------------------------------------------- |
| `name`          | Text   | **Required**. 1-200 chars.                         |
| `description`   | Text   | Optional. Max 2000 chars.                          |
| `category`      | Text   | **Required**. Category ObjectId.                   |
| `variantWeight` | Text   | **Required**. Weight for the first variant.        |
| `variantSize`   | Text   | Optional. Size for the first variant.              |
| `thumbnail`     | File   | Optional. Product thumbnail image.                 |
| `variantImages` | File[] | Optional. Images for the first variant (up to 10). |

**Response (201):**

```json
{
  "message": "Product created",
  "data": {
    "_id": "...",
    "name": "Gold Ring",
    "thumbnail": "https://res.cloudinary.com/...",
    "category": { "_id": "...", "name": "Rings" },
    "variants": [
      {
        "_id": "...",
        "weight": "5g",
        "images": ["https://res.cloudinary.com/..."]
      }
    ]
  }
}
```

---

#### PUT `/api/products/:id` — Update Product Details

**Content-Type:** `multipart/form-data`

Updates product-level fields only (not variants).

| Field         | Type | Description                            |
| ------------- | ---- | -------------------------------------- |
| `name`        | Text | Optional.                              |
| `description` | Text | Optional.                              |
| `category`    | Text | Optional. Category ObjectId.           |
| `thumbnail`   | File | Optional. Replaces existing thumbnail. |

---

#### DELETE `/api/products/:id` — Delete Product

---

## 🎨 Variant Routes

Base URL: `/api/products/:id/variants`

### POST `/api/products/:id/variants` — Add Variant

**Content-Type:** `multipart/form-data`

| Field    | Type   | Description                          |
| -------- | ------ | ------------------------------------ |
| `weight` | Text   | **Required**.                        |
| `size`   | Text   | Optional.                            |
| `images` | File[] | Optional. Variant images (up to 10). |

### PUT `/api/products/:id/variants/:variantId` — Update Variant

**Content-Type:** `multipart/form-data`

| Field            | Type        | Description                                          |
| ---------------- | ----------- | ---------------------------------------------------- |
| `weight`         | Text        | **Required**.                                        |
| `size`           | Text        | Optional.                                            |
| `existingImages` | Text (JSON) | Optional. JSON array of existing image URLs to keep. |
| `images`         | File[]      | Optional. New images to add.                         |

### DELETE `/api/products/:id/variants/:variantId` — Delete Variant

> [!WARNING]
> Cannot delete the last variant. A product must always have at least one variant.

---

## 📱 Frontend Implementation Guide

When submitting forms, use `FormData`:

```javascript
const formData = new FormData();

// Text fields
formData.append("name", "Gold Ring");
formData.append("category", "64f...");
formData.append("variantWeight", "5g");

// Single File (thumbnail)
if (thumbnailFile) {
  // React Native format
  formData.append("thumbnail", {
    uri: thumbnailFile.uri,
    name: "thumb.jpg",
    type: "image/jpeg",
  });
}

// Multiple Files (variant images)
imageFiles.forEach((file) => {
  formData.append("variantImages", {
    uri: file.uri,
    name: "image.jpg",
    type: "image/jpeg",
  });
});

// Send Request — do NOT set Content-Type manually
await fetch(`${API_URL}/products`, {
  method: "POST",
  headers: { "x-admin-key": ADMIN_KEY },
  body: formData,
});
```
 here is updated api doc for product section , updatee accordingly.