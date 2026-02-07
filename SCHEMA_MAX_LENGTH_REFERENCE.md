# Schema Max Length Constraints - Quick Reference

## By Field Type

### User Authentication (user.py)
```python
email:         max_length=255  # Email addresses (RFC 5321)
password:      max_length=128  # Already had constraint
country_code:  max_length=2    # ISO country codes
```

### Document Types (document_type.py)
```python
name:                          max_length=255   # Document type name
country_code:                  max_length=2     # DE, IT
category:                      max_length=255   # Category name
description:                   max_length=1000  # Long description
default_notice_period:         max_length=500   # Text (e.g., "4 Wochen zum Monatsende")
variant_group_name:            max_length=255   # Variant group name
variant_group_description:     max_length=1000  # Variant group description
```

### Conditions (condition.py)
```python
field:         max_length=255  # Form field names
id:            max_length=255  # Frontend UI tracking IDs
operator:      max_length=50   # Comparison operators (=, !=, >, etc.)
```

### Composer - Clauses (composer.py)
```python
# ClauseInstanceBase & Responses
title:                         max_length=255   # Clause title
content_html:                  max_length=10000 # HTML content
visual_style:                  max_length=50    # "green" or "blue"
deviated_reason:               max_length=500   # Reason text
original_content_snapshot:     max_length=10000 # Original HTML

# Library Search
search:                        max_length=500   # Search query
category:                      max_length=255   # Category filter

# Library Response
preview:                       max_length=500   # Content preview

# Draft Response
document_type_name:            max_length=255   # Document type name
name:                          max_length=255   # Draft name
country_code:                  max_length=2     # Country
```

### Tokens (token.py)
```python
access_token:  max_length=2000 # JWT token
token_type:    max_length=50   # "Bearer", etc.
```

---

## Implementation Pattern

All fields use the standard Pydantic pattern:

```python
from pydantic import BaseModel, Field

class MySchema(BaseModel):
    # Simple required string with max_length
    title: str = Field(..., max_length=255)

    # Optional string with max_length
    description: Optional[str] = Field(None, max_length=1000)

    # With default value
    country_code: str = Field(default="DE", max_length=2)

    # With additional constraints
    email: str = Field(..., max_length=255, description="User email")

    # Combined with min_length
    field_name: str = Field(..., min_length=1, max_length=255)
```

---

## Validation Error Example

When a user sends data exceeding max_length:

```python
>>> from backend.app.schemas.user import UserCreate
>>> user = UserCreate(
...     email="a" * 1000 + "@example.com",
...     password="ValidPass123"
... )
ValidationError:
  field: email
  reason: string longer than max length 255
```

---

## By Use Case

### For Development
**When writing schemas, use these guidelines:**
- Names/Titles: 255 chars
- Emails: 255 chars
- Search queries: 500 chars
- HTML content: 10000 chars
- Codes/Tokens: 2-2000 chars based on type

### For Testing
**Test these scenarios:**
1. Valid input (within limit)
2. Max length (exactly at limit)
3. Just over limit (should fail)
4. Special characters and unicode
5. Empty strings (if optional)

### For Deployment
**All constraints are enforced at:**
- Schema validation (Pydantic)
- API request handling
- Response serialization
- Zero database migrations needed

---

## Common Patterns

### Pattern 1: Required String with Length
```python
title: str = Field(..., max_length=255, description="Title")
```

### Pattern 2: Optional String with Length
```python
description: Optional[str] = Field(None, max_length=1000)
```

### Pattern 3: Required with Min and Max
```python
field: str = Field(..., min_length=1, max_length=255)
```

### Pattern 4: Default Value with Max Length
```python
country_code: str = Field(default="DE", max_length=2)
```

---

## Constraint Levels

| Priority | Fields | Limit | Examples |
|----------|--------|-------|----------|
| CRITICAL | User input, search | 255-500 | email, name, title, search |
| HIGH | Content, HTML | 10000 | content_html, snapshots |
| MEDIUM | Metadata | 1000 | description, reason |
| LOW | System | 2-50 | codes, tokens, enums |

---

## How Pydantic Handles It

1. **Validation:** Before instance creation
   ```python
   schema = MySchema(data)  # Validates here
   ```

2. **Error Handling:** Raises ValidationError
   ```python
   try:
       schema = MySchema(data)
   except ValidationError as e:
       # Handle validation errors
   ```

3. **Type Checking:** Works with IDE/mypy
   ```python
   # IDE knows it's a string and validates max_length
   ```

4. **API Integration:** Automatic in route handlers
   ```python
   @router.post("/create")
   async def create(data: MySchema):  # Validates automatically
       return data
   ```

---

## Checking Current Constraints

To see all constraints in a schema:

```python
from backend.app.schemas.user import UserCreate

# View field constraints
for field_name, field_info in UserCreate.model_fields.items():
    constraints = field_info.metadata
    print(f"{field_name}: {constraints}")
    # Output: email: [MaxLen(max_length=255)]
```

---

## Migration from Old Code

If you have old code without constraints:

```python
# OLD - No constraints
class LegacySchema(BaseModel):
    email: str
    name: str
    content: str

# NEW - With constraints
class UpdatedSchema(BaseModel):
    email: str = Field(..., max_length=255)
    name: str = Field(..., max_length=255)
    content: str = Field(..., max_length=10000)
```

Existing API calls still work (backward compatible):
- Valid data: still works
- Oversized data: now rejected with validation error
- Error messages: helpful and clear

---

## Security Aspects

**DoS Prevention:**
- Prevents memory exhaustion from huge strings
- Example: Attacker sends 1GB email field → rejected at validation

**Data Integrity:**
- Ensures consistent limits across APIs
- Prevents database field overflow
- Consistent with HTTP standard limits

**Performance:**
- Validation is fast (< 1ms)
- Enables better indexing in database
- Reduces query complexity

---

## Related Files

- Implementation: `/backend/app/schemas/*.py` (5 files modified)
- Tests: `/backend/tests/schemas/` (recommended)
- Documentation: `SCHEMA_SECURITY_HARDENING_REPORT.md`
- Commit: `10bead21e7390dfcf1529027c6500c943eb2f34a`
