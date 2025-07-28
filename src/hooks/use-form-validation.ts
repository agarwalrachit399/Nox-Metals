import { useState, useCallback } from "react";

type ValidationRule<T> = (value: T) => string | undefined;
type ValidationRules<T> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};
type FormErrors<T> = Partial<Record<keyof T, string>>;

export const useFormValidation = <T extends Record<string, unknown>>(
  validationRules: ValidationRules<T>,
) => {
  const [errors, setErrors] = useState<FormErrors<T>>({});

  const validate = useCallback(
    (data: T): boolean => {
      const newErrors: FormErrors<T> = {};

      (Object.keys(validationRules) as Array<keyof T>).forEach((field) => {
        const rule = validationRules[field];
        if (rule) {
          const error = rule(data[field]);
          if (error) {
            newErrors[field] = error;
          }
        }
      });

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [validationRules],
  );

  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  return { errors, validate, clearError, clearAllErrors, setErrors };
};

// Common validation rules with proper typing
export const validationRules = {
  required:
    (fieldName: string) =>
    (value: unknown): string | undefined =>
      !value || (typeof value === "string" && !value.trim())
        ? `${fieldName} is required`
        : undefined,

  email: (value: string): string | undefined =>
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? "Please enter a valid email address"
      : undefined,

  minLength:
    (min: number, fieldName: string) =>
    (value: string): string | undefined =>
      value.length < min
        ? `${fieldName} must be at least ${min} characters`
        : undefined,

  positiveNumber:
    (fieldName: string) =>
    (value: string): string | undefined => {
      const num = parseFloat(value);
      return isNaN(num) || num <= 0
        ? `${fieldName} must be a positive number`
        : undefined;
    },

  url: (value: string): string | undefined => {
    if (!value.trim()) return undefined;
    try {
      new URL(value);
      return undefined;
    } catch {
      return "Please enter a valid URL";
    }
  },

  passwordStrength: (value: string): string | undefined =>
    !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)
      ? "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      : undefined,

  matchField:
    (otherValue: string, fieldName: string) =>
    (value: string): string | undefined =>
      value !== otherValue ? `${fieldName} do not match` : undefined,
};

// Helper function to combine validation rules
export const combineValidators = <T>(
  ...validators: Array<ValidationRule<T>>
): ValidationRule<T> => {
  return (value: T): string | undefined => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return undefined;
  };
};
