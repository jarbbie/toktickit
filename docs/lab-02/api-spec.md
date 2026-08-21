# Lab 2 API Contract

Base path: `/api`. All JSON errors have the shape `{ "error": "safe message" }`.
`requesterId` is the temporary Lab 2 testing context, not authentication.

## Reference Data

### `GET /api/requesters`

Returns active Development Requesters ordered by name.

```json
[{ "id": 1, "name": "Alice Example", "email": "alice@example.test" }]
```

### `GET /api/categories` and `GET /api/related-systems`

Return active records ordered by name.

```json
[{ "id": 1, "name": "Hardware" }]
```

## Tickets

### `POST /api/tickets`

Creates one ticket. The JSON body is:

```json
{
  "requesterId": 1,
  "categoryId": 1,
  "relatedSystemId": 2,
  "requestedPriority": "MEDIUM",
  "summary": "VPN cannot connect",
  "description": "The VPN fails after entering my university credentials."
}
```

`201 Created` returns the saved ticket, including generated `ticketNumber` and
`status`. `400` is returned for invalid fields or inactive/missing reference
data. `500` returns a safe error.

### `GET /api/tickets`

Required: `requesterId`. Optional query parameters:

```text
search, categoryId, requestedPriority, status,
sortBy=updatedAt|createdAt|ticketNumber|requestedPriority,
direction=asc|desc, page=1, pageSize=5|10|20
```

The default is `sortBy=updatedAt`, `direction=desc`, `page=1`, `pageSize=10`.
`400` is returned for invalid query values. `200 OK` returns:

```json
{
  "items": [{
    "id": 1,
    "ticketNumber": "TKT-2026-A1B2C3D4",
    "summary": "VPN cannot connect",
    "requestedPriority": "MEDIUM",
    "status": "NEW",
    "category": { "id": 1, "name": "Hardware" },
    "updatedAt": "2026-08-21T00:00:00.000Z"
  }],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

### `GET /api/tickets/:ticketId?requesterId=1`

Returns a complete owned ticket, its reference data, and attachment metadata.
Returns `404` when the ticket does not exist or is not owned by that requester.

## Attachments

### `POST /api/tickets/:ticketId/attachments`

Uses `multipart/form-data` with fields `requesterId` and `file`. The owner must
match the ticket. Allowed types: JPG/JPEG, PNG, WEBP, PDF; maximum size: 5 MB;
maximum active files: 5.

`201 Created` returns attachment metadata. `400` covers malformed requests,
`404` covers missing/unowned tickets, `409` covers the active-file limit,
`413` covers oversized files, and `415` covers unsupported types.

### `GET /api/attachments/:attachmentId?requesterId=1`

Returns owned attachment metadata. Removed attachments remain visible as
metadata, including removal information.

### `GET /api/attachments/:attachmentId/download?requesterId=1`

Streams an active owned file with a safe download filename. Returns `404` for a
missing, removed, or unowned attachment.

### `DELETE /api/attachments/:attachmentId`

JSON body:

```json
{ "requesterId": 1, "reason": "Uploaded the wrong screenshot" }
```

Soft-removes an active owned attachment. `200 OK` returns its removed metadata.
`400` covers a missing/invalid reason, and `404` covers missing, already removed,
or unowned attachments.

## General Status Rules

| Status | Meaning |
|---|---|
| `200` | Successful retrieval or soft removal |
| `201` | Ticket or attachment created |
| `400` | Invalid request, validation failure, or invalid query |
| `404` | Missing resource or ownership failure |
| `409` | Attachment active-count limit reached |
| `413` | Uploaded file exceeds 5 MB |
| `415` | Uploaded file type is not permitted |
| `500` | Unexpected server failure; response exposes no stack trace or secrets |
