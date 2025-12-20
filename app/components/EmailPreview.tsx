"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface EmailPreviewProps {
  original: string;
  customized: string | null;
  professorName: string;
  professorEmail: string;
}

export function EmailPreview({
  original,
  customized,
  professorName,
  professorEmail,
}: EmailPreviewProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  if (!customized) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Email Preview</CardTitle>
            <CardDescription>
              To: {professorName} ({professorEmail})
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOriginal(!showOriginal)}
          >
            {showOriginal ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Original
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show Original
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showOriginal && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Original Template:</h4>
            <div className="text-sm whitespace-pre-wrap border rounded p-3 bg-muted/50 max-h-64 overflow-y-auto">
              {original}
            </div>
          </div>
        )}
        <div>
          <h4 className="text-sm font-semibold mb-2">Customized Email:</h4>
          <div className="text-sm whitespace-pre-wrap border rounded p-3 bg-background max-h-96 overflow-y-auto">
            {customized}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

