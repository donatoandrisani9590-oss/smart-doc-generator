import { describe, it, expect } from "vitest";
import {
  requiredString,
  email,
  password,
  simplePassword,
  dateString,
  positiveNumber,
  nonNegativeNumber,
  positiveInteger,
  phoneNumber,
  loginSchema,
  registerSchema,
  clauseSchema,
  deadlineSchema,
  validateForm,
  getFirstError,
  createErrorGetter,
} from "../validations";
// z is available via the schemas imported above

// =============================================================================
// Common validators
// =============================================================================

describe("requiredString", () => {
  it("accepts non-empty string", () => {
    expect(requiredString.parse("hello")).toBe("hello");
  });

  it("trims whitespace", () => {
    expect(requiredString.parse("  hello  ")).toBe("hello");
  });

  it("rejects empty string", () => {
    expect(() => requiredString.parse("")).toThrow();
  });
});

describe("email", () => {
  it("accepts valid email", () => {
    expect(email.parse("test@example.com")).toBe("test@example.com");
  });

  it("rejects invalid email", () => {
    expect(() => email.parse("not-an-email")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => email.parse("")).toThrow();
  });
});

describe("password", () => {
  it("accepts valid password", () => {
    expect(password.parse("Passw0rd")).toBe("Passw0rd");
  });

  it("rejects too short password", () => {
    expect(() => password.parse("Pw1")).toThrow();
  });

  it("rejects password without uppercase", () => {
    expect(() => password.parse("password1")).toThrow();
  });

  it("rejects password without lowercase", () => {
    expect(() => password.parse("PASSWORD1")).toThrow();
  });

  it("rejects password without number", () => {
    expect(() => password.parse("Passwordd")).toThrow();
  });
});

describe("simplePassword", () => {
  it("accepts 6+ chars", () => {
    expect(simplePassword.parse("123456")).toBe("123456");
  });

  it("rejects fewer than 6 chars", () => {
    expect(() => simplePassword.parse("12345")).toThrow();
  });
});

describe("dateString", () => {
  it("accepts valid date", () => {
    expect(dateString.parse("2024-01-15")).toBe("2024-01-15");
  });

  it("rejects invalid format", () => {
    expect(() => dateString.parse("15.01.2024")).toThrow();
  });

  it("rejects invalid date", () => {
    expect(() => dateString.parse("2024-13-01")).toThrow();
  });
});

describe("number validators", () => {
  it("positiveNumber accepts positive", () => {
    expect(positiveNumber.parse(42)).toBe(42);
  });

  it("positiveNumber rejects zero", () => {
    expect(() => positiveNumber.parse(0)).toThrow();
  });

  it("nonNegativeNumber accepts zero", () => {
    expect(nonNegativeNumber.parse(0)).toBe(0);
  });

  it("nonNegativeNumber rejects negative", () => {
    expect(() => nonNegativeNumber.parse(-1)).toThrow();
  });

  it("positiveInteger rejects float", () => {
    expect(() => positiveInteger.parse(1.5)).toThrow();
  });
});

describe("phoneNumber", () => {
  it("accepts valid phone numbers", () => {
    expect(phoneNumber.parse("+49 123 456789")).toBe("+49 123 456789");
  });

  it("accepts empty string (optional)", () => {
    expect(phoneNumber.parse("")).toBe("");
  });

  it("rejects too short number", () => {
    expect(() => phoneNumber.parse("123")).toThrow();
  });
});

// =============================================================================
// Form schemas
// =============================================================================

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "mypassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = loginSchema.safeParse({ email: "", password: "pass" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Passw0rd",
      confirmPassword: "Passw0rd",
      firstName: "Max",
      lastName: "Mustermann",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Passw0rd",
      confirmPassword: "Different1",
      firstName: "Max",
      lastName: "Mustermann",
    });
    expect(result.success).toBe(false);
  });
});

describe("clauseSchema", () => {
  it("accepts valid clause", () => {
    const result = clauseSchema.safeParse({
      title: "Urlaubsanspruch",
      contentHtml: "<p>Der Urlaubsanspruch beträgt...</p>",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = clauseSchema.safeParse({
      title: "",
      contentHtml: "<p>content</p>",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = clauseSchema.safeParse({
      title: "Title",
      contentHtml: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("deadlineSchema", () => {
  it("accepts valid deadline", () => {
    const result = deadlineSchema.safeParse({
      deadlineType: "probezeit_ende",
      deadlineDate: "2024-06-15",
      employeeName: "Max Mustermann",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid deadline type", () => {
    const result = deadlineSchema.safeParse({
      deadlineType: "invalid_type",
      deadlineDate: "2024-06-15",
      employeeName: "Max",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Helper functions
// =============================================================================

describe("validateForm", () => {
  it("returns success with data for valid input", () => {
    const result = validateForm(loginSchema, {
      email: "test@example.com",
      password: "pass123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("returns errors for invalid input", () => {
    const result = validateForm(loginSchema, {
      email: "",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("email");
      expect(result.errors).toHaveProperty("password");
    }
  });
});

describe("getFirstError", () => {
  it("returns first error message", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    if (!result.success) {
      const msg = getFirstError(result.error);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});

describe("createErrorGetter", () => {
  it("returns error for matching field", () => {
    const getError = createErrorGetter({ name: "Required" });
    expect(getError("name")).toBe("Required");
  });

  it("returns undefined for missing field", () => {
    const getError = createErrorGetter({ name: "Required" });
    expect(getError("other")).toBeUndefined();
  });
});
