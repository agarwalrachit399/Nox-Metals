import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner = ({
  message = "Loading...",
  size = "md",
  className,
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <Loader2 className={cn("animate-spin mr-2", sizeClasses[size])} />
      <span className="text-muted-foreground">{message}</span>
    </div>
  );
};

interface FullScreenLoadingProps {
  message?: string;
  title?: string;
  icon?: React.ReactNode;
}

export const FullScreenLoading = ({
  message = "Loading...",
  title,
  icon,
}: FullScreenLoadingProps) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      {icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
          {icon}
        </div>
      )}
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <p className="text-muted-foreground">{message}</p>
    </div>
  </div>
);
