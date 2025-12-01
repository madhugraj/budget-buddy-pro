import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Timeout in milliseconds (e.g., 30 minutes)
const TIMEOUT_MS = 30 * 60 * 1000;

export function AutoLogout() {
    const { signOut, user } = useAuth();
    const { toast } = useToast();
    const timerRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (!user) return;

        const resetTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            timerRef.current = setTimeout(() => {
                handleLogout();
            }, TIMEOUT_MS);
        };

        const handleLogout = async () => {
            await signOut();
            toast({
                title: "Session Expired",
                description: "You have been logged out due to inactivity.",
                variant: "destructive",
            });
        };

        // Events to track activity
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

        // Setup listeners
        const setupListeners = () => {
            events.forEach(event => {
                document.addEventListener(event, resetTimer);
            });
            resetTimer(); // Start timer initially
        };

        // Cleanup listeners
        const cleanupListeners = () => {
            events.forEach(event => {
                document.removeEventListener(event, resetTimer);
            });
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };

        setupListeners();
        return cleanupListeners;
    }, [user, signOut, toast]);

    return null;
}
