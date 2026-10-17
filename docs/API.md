# Mocked API contract

The Frontend track runs against a mocked backend: [MSW](https://mswjs.io) intercepts `fetch` calls in the browser (service worker) and in tests (Node). The mock behaves like a real API. It validates input, classifies results, returns real HTTP status codes and stores data in memory.

- Handlers: [`src/mocks/handlers.ts`](../src/mocks/handlers.ts)
- TypeScript types for every body below: [`src/api/contracts.ts`](../src/api/contracts.ts)
- Client: [`src/api/client.ts`](../src/api/client.ts)

Base path: `/api`. All bodies are JSON.

## Simulated network behaviour

| Behaviour   | Default                          | How to change                                                           |
| ----------- | -------------------------------- | ----------------------------------------------------------------------- |
| Latency     | 300–900 ms per request (random)  | Mock API panel: None / 0.3–0.9 s / 2–3.5 s                              |
| Failures    | None                             | Mock API panel arms a one-shot failure for the next call to an endpoint |
| Persistence | In memory, reseeded on page load | Mock API panel: "Reset demo data"                                       |

Failure modes:

- **`error`**: the server fails before doing anything. Returns `500`, nothing is saved.
- **`errorAfterSave`** (save only): the entry **is saved**, but the response is a `500`. This simulates a lost response. A retry with the same `clientRequestId` returns the saved entry and does not save it again.

## Errors

Every error uses one shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some values are not possible readings.",
    "fieldErrors": {
      "systolicBp": {
        "code": "ABOVE_PLAUSIBLE_MAX",
        "message": "Not a possible Systolic BP value. Check the reading: it must be between 40–300 mmHg."
      }
    },
    "formErrors": ["Enter at least one value before saving."]
  }
}
```

| Status | `code`              | When                                                                                |
| ------ | ------------------- | ----------------------------------------------------------------------------------- |
| 400    | `BAD_REQUEST`       | Body is not JSON, or required structure is missing                                  |
| 400    | `VALIDATION_FAILED` | Body is well-formed but values are not acceptable; see `fieldErrors` / `formErrors` |
| 404    | `NOT_FOUND`         | Unknown patient id                                                                  |
| 500    | `INTERNAL_ERROR`    | Server failure (armed from the Mock API panel)                                      |

`fieldErrors` codes for results: `NOT_A_NUMBER`, `TOO_MANY_DECIMALS`, `BELOW_PLAUSIBLE_MIN`, `ABOVE_PLAUSIBLE_MAX`, `CROSS_FIELD`.

---

## `GET /api/patients`

Lists patients, sorted by name. Each one includes a summary of their latest result for triage in the sidebar.

```json
[
  {
    "id": "p-rahul-verma",
    "name": "Rahul Verma",
    "age": 61,
    "sex": "male",
    "latestResult": { "recordedAt": "2026-10-17T04:00:00.000Z", "abnormal": 2, "critical": 1 }
  },
  { "id": "p-meera-iyer", "name": "Meera Iyer", "age": 72, "sex": "female", "latestResult": null }
]
```

`abnormal` counts every value outside the normal range, critical ones included.

## `POST /api/patients`

```json
{ "name": "Lena Fischer", "age": 38, "sex": "female" }
```

| Field  | Rule                                                                    |
| ------ | ----------------------------------------------------------------------- |
| `name` | Required, trimmed, internal whitespace collapsed, at most 80 characters |
| `age`  | Whole number, 18–120 (reference ranges are adult only)                  |
| `sex`  | `"female"` or `"male"` (selects sex-specific reference ranges)          |

`201` returns the created patient `{ id, name, age, sex }`. `400 VALIDATION_FAILED` has `fieldErrors` keyed by `name` / `age` / `sex`.

## `GET /api/patients/:patientId`

`200` returns `{ id, name, age, sex }`. `404` if the patient is unknown.

## `GET /api/parameters`

The reference configuration. The UI never hard-codes ranges. It uses this response to build the form and preview flags.

```json
{
  "parameters": [
    {
      "id": "haemoglobin",
      "name": "Haemoglobin",
      "unit": "g/dL",
      "category": "labs",
      "decimals": 1,
      "plausible": { "low": 1, "high": 25 },
      "normal": { "female": { "low": 12, "high": 15.5 }, "male": { "low": 13.5, "high": 17.5 } },
      "critical": { "low": 7, "high": 20 }
    }
  ],
  "policy": { "normalRangeInclusive": true, "criticalLimitInclusive": true },
  "crossFieldRules": [
    {
      "kind": "lessThan",
      "id": "diastolic-below-systolic",
      "lower": "diastolicBp",
      "higher": "systolicBp",
      "reportOn": "diastolicBp"
    }
  ]
}
```

- `normal` is either a single range or `{ female, male }`.
- `plausible` bounds are inclusive. A value outside them is a validation error and is never classified.
- `decimals` is the maximum number of decimal places accepted.

## `GET /api/patients/:patientId/results`

The patient's result entries, **newest first**. `404` if the patient is unknown.

```json
[
  {
    "id": "r-mgx1-7",
    "patientId": "p-rahul-verma",
    "recordedAt": "2026-10-17T04:00:00.000Z",
    "values": [
      {
        "parameterId": "potassium",
        "value": 6.3,
        "unit": "mmol/L",
        "classification": "CRITICAL_HIGH",
        "referenceRange": { "normal": { "low": 3.5, "high": 5 }, "critical": { "low": 2.8, "high": 6.2 } }
      }
    ],
    "summary": { "abnormal": 1, "critical": 1 }
  }
]
```

`classification` is one of `NORMAL`, `LOW`, `HIGH`, `CRITICAL_LOW`, `CRITICAL_HIGH`.

`referenceRange` is a snapshot of the ranges used when the value was classified. History stays accurate even if the configuration changes later.

## `POST /api/patients/:patientId/results`

Saves one result entry: a set of values for one patient at one point in time. The server validates and **classifies** every value.

```json
{
  "clientRequestId": "6f0c2c1e-3f0e-4b8e-9d2a-2b8f6f1d9a10",
  "values": { "systolicBp": 186, "diastolicBp": 94, "potassium": 4.1 }
}
```

| Field             | Rule                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientRequestId` | Required string. Idempotency key generated by the client once per draft and reused on retry                                                                                                                 |
| `values`          | Object of `parameterId → number`. Omit (or send `null` for) parameters that were not measured. At least one value is required. Unknown parameter ids are rejected. Values must be JSON numbers, not strings |

Responses:

| Status                  | Meaning                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `201`                   | Saved. Body is the new `ResultEntry` (shape as above), classified by the server                                                                               |
| `200`                   | This `clientRequestId` was already saved. Body is the original entry; nothing new is stored                                                                   |
| `400 VALIDATION_FAILED` | `fieldErrors` per parameter (impossible value, too many decimals, diastolic ≥ systolic); `formErrors` for entry-level problems (no values, unknown parameter) |
| `400 BAD_REQUEST`       | Missing `values` object or `clientRequestId`, or the `clientRequestId` was used for another patient                                                           |
| `404 NOT_FOUND`         | Unknown patient                                                                                                                                               |
| `500 INTERNAL_ERROR`    | Server failure; the client keeps the form and offers "Try again"                                                                                              |

`recordedAt` is set by the server at save time.
