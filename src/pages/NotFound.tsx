
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 px-4">
      <div className="glass-panel rounded-xl p-10 text-center max-w-md animate-fade-in">
        <h1 className="text-7xl font-light mb-6 text-primary">404</h1>
        <p className="text-xl text-foreground mb-6">This page doesn't exist</p>
        <p className="text-muted-foreground mb-8">The page you're looking for couldn't be found.</p>
        <a 
          href="/" 
          className="inline-flex items-center text-primary hover:text-primary/80 transition-colors"
        >
          <ArrowLeft size={16} className="mr-2" />
          <span>Return to chatbot</span>
        </a>
      </div>
    </div>
  );
};

export default NotFound;
