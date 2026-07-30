import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Supabase client automatically handles the OAuth callback if the URL contains ?code=...
    // It exchanges the code for a session and stores it in localStorage.
    
    // We just wait for the session to be established.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        toast.success("Successfully signed in with Google");
        navigate({ to: "/dashboard" });
      }
    });

    // Check if there's an error in the URL (e.g. user cancelled)
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");

    if (error) {
      setErrorMsg(errorDescription || error);
      toast.error(errorDescription || error);
      navigate({ to: "/auth" });
    }

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-hero-grad grid place-items-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          {errorMsg ? "Redirecting..." : "Verifying authentication..."}
        </p>
      </div>
    </div>
  );
}
