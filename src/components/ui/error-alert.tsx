import { AlertTriangle, RefreshCw, Shield, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorAlertProps {
  error: string;
  onRetry?: () => void;
  variant?: "default" | "destructive";
  className?: string;
}

export const ErrorAlert = ({
  error,
  onRetry,
  variant = "destructive",
  className,
}: ErrorAlertProps) => (
  <Alert variant={variant} className={className}>
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription className="flex items-center justify-between">
      {error}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </AlertDescription>
  </Alert>
);

interface AccessDeniedAlertProps {
  message?: string;
  onRetry?: () => void;
}

export const AccessDeniedAlert = ({
  message = "Access denied. You do not have permission to perform this action.",
  onRetry,
}: AccessDeniedAlertProps) => (
  <Alert variant="destructive">
    <Shield className="h-4 w-4" />
    <AlertDescription className="flex items-center justify-between">
      {message}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </AlertDescription>
  </Alert>
);

interface FormErrorAlertProps {
  error: string;
}

export const FormErrorAlert = ({ error }: FormErrorAlertProps) => (
  <Alert variant="destructive">
    <XCircle className="h-4 w-4" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
);
