add a section in home screen  called - Update Bhav.
on click on that screen we have new screen to update bhav 
we have 4 field - Gold 999 gold 995 rtgs gold , and silver .
user can update a field and click on update button to update bhav .
we have to show last updated date and time of each field .
we have to show last updated by user of each field .
we have to show last updated by user of each field .
we have to show last updated by user of each field .


here is api doc -Authentication
All admin endpoints require the x-admin-key header to be set with the configured ADMIN_API_KEY.

Header:
baseurl-https://ssj-server.onrender.com
x-admin-key: ayushseth958
Endpoints
1. Get All Static Rates
Retrieves the current static bhav rates.

URL: /api/admin/static
Method: GET
Success Response:
{
  "data": {
    "silver_bhav": { "value": 75000, "updated_at": "..." },
    "gold_995_bhav": { "value": 62000, "updated_at": "..." },
    ...
  },
  "validKeys": ["silver_bhav", "gold_995_bhav", "gold_999_bhav", "rtgs_bhav"]
}
2. Update Multiple Rates
Update multiple static rates at once. Any connected clients will receive the update immediately via SSE.

URL: /api/admin/static
Method: PUT
Body:
{
  "silver_bhav": 76000,
  "gold_999_bhav": 63000
}
Success Response:
{
  "message": "Successfully updated 2 values",
  "data": { ... }
}
3. Update Single Rate
Update a specific rate by its key.

URL: /api/admin/static/:key
Method: PATCH
URL Params: key (e.g., gold_999_bhav)
Body:
{
  "value": 63500
}
Success Response:
{
  "message": "Successfully updated gold_999_bhav",
  "data": { "value": 63500, "updated_at": "..." }
}
Curl Examples
Update Gold 999:

curl -X PATCH http://localhost:3000/api/admin/static/gold_999_bhav \
  -H "x-admin-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"value": 64000}'