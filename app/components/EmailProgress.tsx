"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Pause, Play, Trash2, CheckCircle2, XCircle, Clock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueueProgress } from "@/lib/hooks/useEmailQueue";

interface EmailProgressProps {
  progress: QueueProgress;
  onPause?: () => void;
  onResume?: () => void;
  onClear?: () => void;
  onClearCompleted?: () => void;
  isProcessing: boolean;
  className?: string;
}

export function EmailProgress({
  progress,
  onPause,
  onResume,
  onClear,
  onClearCompleted,
  isProcessing,
  className,
}: EmailProgressProps) {
  const { currentIndex, total, currentItem, status, message, percentage } = progress;

  if (total === 0) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Mail className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    if (status === 'completed') {
      return 'Completed';
    }
    
    if (currentItem) {
      if (message) {
        return message;
      }
      switch (currentItem.status) {
        case 'processing':
          return `Preparing email for ${currentItem.applicationName}...`;
        case 'sending':
          return `Sending email to ${currentItem.applicationName}...`;
        default:
          return `Processing email ${currentIndex} of ${total}...`;
      }
    }
    
    return `Processing email ${currentIndex} of ${total}...`;
  };

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <div>
                <h3 className="text-sm font-medium">
                  {status === 'completed' 
                    ? 'Email Queue Complete' 
                    : 'Email Queue Processing'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {getStatusText()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isProcessing && onPause && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPause}
                  className="h-8 w-8 p-0"
                  title="Pause"
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              {!isProcessing && onResume && status !== 'completed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResume}
                  className="h-8 w-8 p-0"
                  title="Resume"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {onClearCompleted && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearCompleted}
                  className="h-8 w-8 p-0"
                  title="Clear completed"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {onClear && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  className="h-8 w-8 p-0 text-destructive"
                  title="Clear all"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {status === 'completed' 
                  ? `Completed: ${currentIndex}/${total} emails`
                  : `Email ${currentIndex} of ${total}`}
              </span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>

          {/* Current Item Details */}
          {currentItem && status !== 'completed' && (
            <div className="pt-2 border-t space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Current:</span>
                <span className="font-medium">{currentItem.applicationName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Email:</span>
                <span className="text-muted-foreground truncate ml-2 max-w-[200px]">
                  {currentItem.email}
                </span>
              </div>
              {currentItem.attachmentIds && currentItem.attachmentIds.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Attachments:</span>
                  <span className="text-muted-foreground">
                    {currentItem.attachmentIds.length}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {currentItem?.error && (
            <div className="pt-2 border-t">
              <div className="flex items-start gap-2 text-xs">
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-red-600 dark:text-red-400">
                    Error: {currentItem.applicationName}
                  </p>
                  <p className="text-muted-foreground break-words mt-1">
                    {currentItem.error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

