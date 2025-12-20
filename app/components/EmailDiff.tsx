"use client";

import { useMemo } from "react";
import { diffWords, diffLines, diffSentences, Change } from "diff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitCompare, Eye, EyeOff, Check } from "lucide-react";
import { useState } from "react";

interface EmailDiffProps {
  original: string;
  customized: string;
  title?: string;
  onApply?: () => void;
}

export function EmailDiff({ original, customized, title = "Email Changes", onApply }: EmailDiffProps) {
  const [viewMode, setViewMode] = useState<"diff" | "side-by-side">("diff");
  const [showUnchanged, setShowUnchanged] = useState(false);

  // Use sentence-level diff for emails (more natural for email content)
  const sentenceDiff = useMemo(() => {
    return diffSentences(original, customized);
  }, [original, customized]);

  // Also compute word-level diff for inline highlighting
  const wordDiff = useMemo(() => {
    return diffWords(original, customized);
  }, [original, customized]);

  const lineDiff = useMemo(() => {
    // Also compute line-level diff for side-by-side view
    return diffLines(original, customized);
  }, [original, customized]);

  // Calculate statistics
  const stats = useMemo(() => {
    const added = sentenceDiff.filter((p: Change) => p.added).reduce((sum: number, p: Change) => sum + p.value.length, 0);
    const removed = sentenceDiff.filter((p: Change) => p.removed).reduce((sum: number, p: Change) => sum + p.value.length, 0);
    const addedSentences = sentenceDiff.filter((p: Change) => p.added).length;
    const removedSentences = sentenceDiff.filter((p: Change) => p.removed).length;
    const addedWords = sentenceDiff.filter((p: Change) => p.added).reduce((sum: number, p: Change) => sum + p.value.split(/\s+/).filter((w: string) => w).length, 0);
    const removedWords = sentenceDiff.filter((p: Change) => p.removed).reduce((sum: number, p: Change) => sum + p.value.split(/\s+/).filter((w: string) => w).length, 0);
    return { added, removed, addedWords, removedWords, addedSentences, removedSentences };
  }, [sentenceDiff]);

  // Render word-level highlights within sentences for more granular diff
  const renderHighlightedText = (sentence: string, isAdded: boolean, isRemoved: boolean) => {
    if (!isAdded && !isRemoved) {
      return <span>{sentence}</span>;
    }

    // Get word-level diff for this specific sentence
    const sentenceWordDiff = diffWords(sentence, sentence);

    // If it's added/removed, highlight the entire sentence with word-level granularity
    if (isAdded || isRemoved) {
      // For added/removed sentences, show word-level changes if the sentence appears in both
      // Otherwise, just highlight the whole sentence
      return (
        <span className={isAdded ? "font-semibold" : isRemoved ? "line-through opacity-75" : ""}>
          {sentence}
        </span>
      );
    }

    return <span>{sentence}</span>;
  };

  const renderDiffView = () => {
    const hasChanges = sentenceDiff.some((part: Change) => part.added || part.removed);
    
    if (!hasChanges && !showUnchanged) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-4xl mb-2">✓</div>
          <p className="text-sm font-medium">No changes detected</p>
          <p className="text-xs mt-1">The customized email is identical to the original.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {sentenceDiff.map((part: Change, index: number) => {
          if (!part.added && !part.removed && !showUnchanged) {
            return null;
          }

          const bgColor =
            part.added
              ? "bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500"
              : part.removed
              ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500"
              : "bg-muted/20 border-l-4 border-muted";

          const textColor =
            part.added
              ? "text-green-900 dark:text-green-100"
              : part.removed
              ? "text-red-900 dark:text-red-100"
              : "text-foreground/70";

          const prefix = part.added ? "+" : part.removed ? "-" : " ";
          const icon = part.added ? "✓" : part.removed ? "✗" : "";

          return (
            <div
              key={index}
              className={`${bgColor} ${textColor} px-4 py-3 rounded-r-md whitespace-pre-wrap break-words transition-colors`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center min-w-[2rem]">
                  <span className="select-none font-bold text-sm">{prefix}</span>
                  {icon && <span className="text-xs opacity-50">{icon}</span>}
                </div>
                <div className="flex-1 font-sans text-sm leading-relaxed">
                  {renderHighlightedText(part.value, part.added === true, part.removed === true)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSideBySideView = () => {
    // Use sentence-level diff for side-by-side view (more accurate for emails)
    const result: Array<{ original: string | null; customized: string | null; type: "unchanged" | "removed" | "added" }> = [];

    sentenceDiff.forEach((change: Change) => {
      if (change.removed) {
        result.push({ original: change.value, customized: null, type: "removed" });
      } else if (change.added) {
        result.push({ original: null, customized: change.value, type: "added" });
      } else {
        result.push({ original: change.value, customized: change.value, type: "unchanged" });
      }
    });

    // Render word-level highlights within sentences
    // For side-by-side, we show sentence-level changes, but can highlight words within modified sentences
    const renderSentenceWithHighlights = (sentence: string, type: "unchanged" | "removed" | "added") => {
      if (type === "unchanged") {
        return <span>{sentence}</span>;
      }
      
      // For added/removed sentences, show the full sentence with appropriate styling
      // Word-level highlighting would require comparing with the corresponding sentence from the other side
      return <span>{sentence}</span>;
    };

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 py-2 border-r pr-4">
          <div className="text-xs font-semibold text-muted-foreground mb-3 sticky top-0 bg-background pb-2 border-b">
            Original Email
          </div>
          {result.map((item, index) => {
            if (item.original === null) {
              // Empty space for added sentences
              return <div key={index} className="h-8 bg-muted/20 border-l-4 border-transparent"></div>;
            }
            if (!showUnchanged && item.type === "unchanged") {
              return null;
            }
            const bgColor =
              item.type === "removed"
                ? "bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500"
                : item.type === "unchanged"
                ? showUnchanged ? "bg-muted/10" : "bg-transparent"
                : "";
            const textColor = item.type === "removed" 
              ? "text-red-900 dark:text-red-100 font-medium" 
              : "text-foreground";
            return (
              <div
                key={index}
                className={`${bgColor} ${textColor} px-3 py-2.5 rounded-r whitespace-pre-wrap break-words text-sm leading-relaxed font-sans`}
              >
                {renderSentenceWithHighlights(item.original, item.type)}
              </div>
            );
          })}
        </div>
        <div className="space-y-1 py-2">
          <div className="text-xs font-semibold text-muted-foreground mb-3 sticky top-0 bg-background pb-2 border-b">
            Customized Email
          </div>
          {result.map((item, index) => {
            if (item.customized === null) {
              // Empty space for removed sentences
              return <div key={index} className="h-8 bg-muted/20 border-l-4 border-transparent"></div>;
            }
            if (!showUnchanged && item.type === "unchanged") {
              return null;
            }
            const bgColor =
              item.type === "added"
                ? "bg-green-50 dark:bg-green-950/30 border-l-4 border-green-500"
                : item.type === "unchanged"
                ? showUnchanged ? "bg-muted/10" : "bg-transparent"
                : "";
            const textColor = item.type === "added" 
              ? "text-green-900 dark:text-green-100 font-medium" 
              : "text-foreground";
            return (
              <div
                key={index}
                className={`${bgColor} ${textColor} px-3 py-2.5 rounded-r whitespace-pre-wrap break-words text-sm leading-relaxed font-sans`}
              >
                {renderSentenceWithHighlights(item.customized, item.type)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {stats.added > 0 || stats.removed > 0 ? (
              <div className="text-xs text-muted-foreground mt-1">
                {stats.addedWords > 0 && <span className="text-green-600 dark:text-green-400">+{stats.addedWords} words added</span>}
                {stats.addedWords > 0 && stats.removedWords > 0 && <span className="mx-2">•</span>}
                {stats.removedWords > 0 && <span className="text-red-600 dark:text-red-400">-{stats.removedWords} words removed</span>}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode(viewMode === "diff" ? "side-by-side" : "diff");
              }}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              {viewMode === "diff" ? "Side-by-Side" : "Unified Diff"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowUnchanged(!showUnchanged);
              }}
            >
              {showUnchanged ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Unchanged
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Unchanged
                </>
              )}
            </Button>
            {onApply && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onApply();
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Apply Changes
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg p-4 bg-background max-h-[600px] overflow-y-auto">
          {viewMode === "diff" ? renderDiffView() : renderSideBySideView()}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 rounded"></div>
            <span>Added</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 rounded"></div>
            <span>Removed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

