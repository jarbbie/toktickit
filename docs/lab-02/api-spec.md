# Lab 2 API Contract

Base path: `/api`. All JSON errors have the shape `{ "error": "safe message" }`.
`requesterId` is the temporary Lab 2 testing context, not authentication.

## Reference Data

### `GET /api/requesters`

Returns active Development Requesters ordered by name.

```json
[{ "id": 1, "name": "Alice Example", "email": "alice@example.test" }]
```

Returns `500 { "error": "Unable to load requesters." }` on an unexpected
database failure.

### `GET /api/categories` and `GET /api/related-systems`

Return active records ordered by name.

```json
[{ "id": 1, "name": "Hardware" }]
```

Each endpoint returns `500` with its own safe loading message on an unexpected
database failure.

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

`201 Created` returns the saved Ticket, including `id`, generated
`ticketNumber`, supplied foreign keys and text, `requestedPriority`, `status`,
`createdAt`, and `updatedAt`. `400` is returned for invalid fields or
inactive/missing reference data. Malformed JSON returns `400`; JSON over the
parser limit returns safe JSON with `413`; unexpected failures return `500`.

The optional Create Ticket attachment is uploaded afterward through the
Attachment endpoint. If that upload fails, the client retains the already-created
Ticket and displays a warning rather than submitting the Ticket again.

### `GET /api/tickets`

Required: `requesterId`. Optional query parameters:

```text
search, categoryId, requestedPriority, status,
sortBy=updatedAt|createdAt|ticketNumber|requestedPriority,
direction=asc|desc, page=1, pageSize=5|10|20
```

The default is `sortBy=updatedAt`, `direction=desc`, `page=1`, `pageSize=10`.
Ticket ID is the deterministic secondary sort in the same direction as the
selected primary sort.
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

Unexpected failures return `500 { "error": "Unable to load tickets." }`.

### `GET /api/tickets/:ticketId?requesterId=1`

Returns a complete owned ticket, its reference data, and attachment metadata.
Returns `404` when the ticket does not exist or is not owned by that requester.
The response contains Ticket IDs, number, Summary, Description, priority,
status, timestamps, Category and Related System `{ id, name }`, and the
Attachment metadata shape below. Invalid identifiers return `400`; unexpected
failures return `500 { "error": "Unable to load ticket." }`.

## Attachments

### `POST /api/tickets/:ticketId/attachments`

Uses `multipart/form-data` with fields `requesterId` and `file`. The owner must
match the ticket. Allowed types: JPG/JPEG, PNG, WEBP, PDF; maximum size: 5 MB;
maximum active files: 5.

`201 Created` returns the Attachment metadata shape below. `400` covers malformed requests,
`404` covers missing/unowned tickets, `409` covers the active-file limit,
`413` covers oversized files, `415` covers unsupported types or content that
does not match its declared type, and `500` safely reports an unexpected upload
failure. A failed database transaction removes any stored file.

```json
{
  "id": 4,
  "originalName": "evidence.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 2048,
  "createdAt": "2026-09-05T00:00:00.000Z",
  "removedAt": null,
  "removalReason": null
}
```

### `GET /api/attachments/:attachmentId?requesterId=1`

Returns owned attachment metadata. Removed attachments remain visible as
metadata, including removal information.
Invalid identifiers return `400`, missing or unowned Attachments return `404`,
and unexpected failures return a safe `500`.

### `GET /api/attachments/:attachmentId/download?requesterId=1`

Streams an active owned file with a safe download filename. Returns `404` for a
missing, removed, or unowned attachment.
Invalid identifiers return `400`; an unexpected storage or database failure
returns a safe `500` response when headers have not been sent.

### `DELETE /api/attachments/:attachmentId`

JSON body:

```json
{ "requesterId": 1, "reason": "Uploaded the wrong screenshot" }
```

Soft-removes an active owned attachment. `200 OK` returns its removed metadata.
`400` covers a missing/invalid reason, and `404` covers missing, already removed,
or unowned attachments. Unexpected failures return a safe `500`.

## General Status Rules

| Status | Meaning |
|---|---|
| `200` | Successful retrieval or soft removal |
| `201` | Ticket or attachment created |
| `400` | Invalid request, validation failure, or invalid query |
| `404` | Missing resource or ownership failure |
| `409` | Attachment active-count limit reached |
| `413` | JSON request body or uploaded file exceeds its size limit |
| `415` | Uploaded file type is not permitted |
| `500` | Unexpected server failure; response exposes no stack trace or secrets |
