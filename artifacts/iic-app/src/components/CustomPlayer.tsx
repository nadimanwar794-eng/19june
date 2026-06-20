import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Youtube, ArrowLeft } from 'lucide-react';

interface BadgePos {
    portrait?:  { bottom: number; right: number };
    landscape?: { bottom: number; right: number };
    fsButton?:  { bottom: number; right: number };
}

interface CustomPlayerProps {
    videoUrl: string;
    brandingText?: string;
    brandingLogo?: string;
    brandingLogoConfig?: any;
    onEnded?: () => void;
    blockShare?: boolean;
    onBrandingClick?: () => void;
    onBack?: () => void;
    onNext?: () => void;
    nextTitle?: string;
    badgePos?: BadgePos;
    isAdmin?: boolean;
    onBadgePosChange?: (pos: {
        portrait:  { bottom: number; right: number };
        landscape: { bottom: number; right: number };
        fsButton:  { bottom: number; right: number };
    }) => void;
    badgeLabel?:    string;
    fsButtonLabel?: string;
}

const DEFAULT_LANDSCAPE = { bottom: 5.6, right: 5.0 };

// Auto-scale font size so button stays same size
const autoFontSize = (text: string, base = 11, min = 7, max = 13): number => {
    const len = text.length;
    if (len <= 6)  return Math.min(max, base + 2);
    if (len <= 10) return base;
    if (len <= 16) return Math.max(min + 1, base - 2);
    return min;
};

export const CustomPlayer: React.FC<CustomPlayerProps> = ({
    videoUrl, brandingLogo, onBrandingClick, onBack, onNext, nextTitle,
    badgePos, isAdmin, onBadgePosChange, badgeLabel, fsButtonLabel: _fsButtonLabel,
}) => {
    const containerRef  = useRef<HTMLDivElement>(null);
    const hideTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
    const topBarTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isFullscreen,  setIsFullscreen]  = useState(false);
    const [rotated,       setRotated]       = useState(false);
    const [isLandscape,   setIsLandscape]   = useState(() => window.innerWidth > window.innerHeight);
    const [ctrlVisible,   setCtrlVisible]   = useState(false);
    const [topBarVisible, setTopBarVisible] = useState(false);

    // ── Badge position (landscape only now) ─────────────────────────────────
    const [badgeBottom, setBadgeBottom] = useState(badgePos?.landscape?.bottom ?? DEFAULT_LANDSCAPE.bottom);
    const [badgeRight,  setBadgeRight]  = useState(badgePos?.landscape?.right  ?? DEFAULT_LANDSCAPE.right);
    const [editMode,    setEditMode]    = useState(false);
    const [saveMsg,     setSaveMsg]     = useState('');

    const dragRef    = useRef<{ startX: number; startY: number; initBottom: number; initRight: number } | null>(null);
    const isDragging = useRef(false);
    const posLoaded  = useRef(false);

    // Load from Firebase only once
    useEffect(() => {
        if (badgePos && !posLoaded.current) {
            posLoaded.current = true;
            setBadgeBottom(badgePos.landscape?.bottom ?? DEFAULT_LANDSCAPE.bottom);
            setBadgeRight(badgePos.landscape?.right   ?? DEFAULT_LANDSCAPE.right);
        }
    }, [badgePos]);

    // Badge drag handler
    useEffect(() => {
        if (!editMode) return;
        const onMove = (e: PointerEvent) => {
            if (!isDragging.current || !dragRef.current || !containerRef.current) return;
            const rect  = containerRef.current.getBoundingClientRect();
            const dx    = e.clientX - dragRef.current.startX;
            const dy    = e.clientY - dragRef.current.startY;
            const initB = dragRef.current.initBottom;
            const initR = dragRef.current.initRight;
            setBadgeBottom(prev => Math.max(0, Math.min(90, initB - (dy / rect.height) * 100)));
            setBadgeRight(prev  => Math.max(0, Math.min(90, initR - (dx / rect.width)  * 100)));
        };
        const onUp = () => { isDragging.current = false; dragRef.current = null; };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup',   onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup',   onUp);
        };
    }, [editMode]);

    // Show top bar briefly then auto-hide
    const showTopBar = useCallback(() => {
        setTopBarVisible(true);
        if (topBarTimer.current) clearTimeout(topBarTimer.current);
        topBarTimer.current = setTimeout(() => setTopBarVisible(false), 4000);
    }, []);

    // ── Source detection ────────────────────────────────────────────────────
    let videoId = '';
    let isDrive = false;
    let isNotebookLM = false;
    try {
        if (videoUrl.includes('youtu.be/'))         videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
        else if (videoUrl.includes('v='))            videoId = videoUrl.split('v=')[1].split('&')[0];
        else if (videoUrl.includes('embed/'))        videoId = videoUrl.split('embed/')[1].split('?')[0];
        if (videoId?.includes('?'))                  videoId = videoId.split('?')[0];
        if (videoUrl.includes('drive.google.com'))   isDrive = true;
        else if (videoUrl.includes('notebooklm'))    isNotebookLM = true;
    } catch (_) {}

    const isYouTube = !!videoId && !isDrive && !isNotebookLM;

    let driveFileId = '';
    if (isDrive) {
        const m = videoUrl.match(/\/d\/([^/]+)/);
        driveFileId = m ? m[1] : '';
    }

    const embedUrl = isDrive
        ? `https://drive.google.com/file/d/${driveFileId}/preview`
        : isNotebookLM
        ? videoUrl
        : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&showinfo=0&disablekb=0&fs=0`;

    const blockMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    useEffect(() => {
        const onChange = () => {
            const inFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
            setIsFullscreen(inFs);
        };
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    // ── Cleanup on unmount: unlock orientation and exit fullscreen ───────────
    useEffect(() => {
        return () => {
            setRotated(false);
            try { (screen as any).orientation?.unlock?.(); } catch (_) {}
            try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
        };
    }, []);

    // showControls declared BEFORE useEffects that depend on it (avoids TDZ)
    const showControls = useCallback(() => {
        setCtrlVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setCtrlVisible(false), 3000);
    }, []);

    const goFullscreen = useCallback(async () => {
        setRotated(false);
        const el = containerRef.current;
        if (!el) return;
        await new Promise(r => setTimeout(r, 80));
        try {
            if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' } as any);
            else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
        } catch (_) {}
    }, []);

    const exitFs = useCallback(async () => {
        try { (screen as any).orientation?.unlock?.(); } catch (_) {}
        try {
            if (document.fullscreenElement || (document as any).webkitFullscreenElement)
                await document.exitFullscreen();
        } catch (_) {}
    }, []);

    // Listen to real orientation changes
    useEffect(() => {
        const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
        window.addEventListener('resize', check);
        window.addEventListener('orientationchange', check);
        const so: any = (screen as any).orientation;
        so?.addEventListener?.('change', check);
        return () => {
            window.removeEventListener('resize', check);
            window.removeEventListener('orientationchange', check);
            so?.removeEventListener?.('change', check);
        };
    }, []);

    // Detect taps inside cross-origin YouTube iframe via window blur
    useEffect(() => {
        const onBlur = () => { showControls(); };
        window.addEventListener('blur', onBlur);
        return () => window.removeEventListener('blur', onBlur);
    }, [showControls]);

    useEffect(() => () => {
        if (hideTimer.current)   clearTimeout(hideTimer.current);
        if (topBarTimer.current) clearTimeout(topBarTimer.current);
    }, []);

    if (!videoId && !isDrive && !isNotebookLM) {
        return (
            <div className="w-full h-full bg-black flex items-center justify-center">
                <div className="text-center space-y-3">
                    <Youtube size={40} className="text-white/30 mx-auto" />
                    <p className="text-white/50 text-sm">Invalid video URL</p>
                </div>
            </div>
        );
    }

    // Always landscape (fixed overlay)
    const outerStyle: React.CSSProperties = rotated
        ? { position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }
        : {
            position: 'relative', width: '100%', height: '100%', minHeight: 0,
            background: '#000',
            WebkitUserSelect: 'none', userSelect: 'none',
            WebkitTouchCallout: 'none',
          };

    const iframeWrapStyle: React.CSSProperties = rotated
        ? {
            position: 'absolute', top: '50%', left: '50%',
            width: '100vh', height: '100vw',
            transform: 'translate(-50%, -50%) rotate(90deg)',
            transformOrigin: 'center center',
            overflow: 'hidden',
          }
        : { position: 'absolute', inset: 0, overflow: 'hidden' };

    const blocker = (extra: React.CSSProperties): React.CSSProperties => ({
        position: 'absolute', zIndex: 20,
        background: 'transparent',
        pointerEvents: 'all', cursor: 'default',
        ...extra,
    });

    const badgeText = badgeLabel?.trim() || 'IIC×NSTA';
    const badgeFontSize = autoFontSize(badgeText, 11, 7, 13);

    return (
        <div
            ref={containerRef}
            style={outerStyle}
            onPointerDown={showControls}
            onTouchStart={showControls}
            onContextMenu={blockMenu}
        >
            <div style={iframeWrapStyle}>
                <iframe
                    src={embedUrl}
                    style={{
                        position: 'absolute', top: 0, left: 0,
                        width: '100%', height: '100%',
                        border: 'none', display: 'block',
                        pointerEvents: 'auto',
                    }}
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="Video"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                />

                {/* ── YouTube protections ── */}
                {isYouTube && (<>
                    {/* Top — black bar covers title/channel/settings
                        Portrait: always on
                        Landscape: follows YouTube's own control bar (ctrlVisible) */}
                    {!isLandscape && !rotated && (
                    <div
                        style={blocker({
                            top: 0, left: 0, right: 0,
                            height: 130,
                            background: '#000',
                        })}
                        onPointerDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        onContextMenu={e => e.preventDefault()}
                    />
                    )}
                    {/* Bottom — covers only YouTube logo + link icon row in portrait */}
                    {!isLandscape && !rotated && (
                    <div
                        style={blocker({
                            bottom: 0, left: 0, right: 0,
                            height: 70,
                            background: '#000',
                        })}
                        onPointerDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        onContextMenu={e => e.preventDefault()}
                    />
                    )}
                    {/* Landscape top-left — transparent blocker ONLY over channel avatar+name, NOT settings/CC */}
                    {isLandscape && !rotated && (
                    <div
                        style={blocker({
                            top: 0, left: 0,
                            width: 220,
                            height: 64,
                            background: 'transparent',
                        })}
                        onPointerDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        onContextMenu={e => e.preventDefault()}
                    />
                    )}
                </>)}

                {/* ── Drive / NotebookLM protections ── */}
                {(isDrive || isNotebookLM) && (<>
                    {/* Top bar — covers "Open in Drive", app picker, download icon */}
                    <div
                        style={blocker({ top: 0, left: 0, right: 0, height: 52 })}
                        onPointerDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                    />
                    {/* Bottom-right — covers download, more-options (⋮), pop-out */}
                    <div
                        style={blocker({ bottom: 0, right: 0, width: '55%', height: 52 })}
                        onPointerDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                    />
                    {/* Bottom-left edge — covers any extra Drive branding/link */}
                    <div
                        style={blocker({ bottom: 0, left: 0, width: 56, height: 52 })}
                        onPointerDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                    />
                </>)}

            </div>


            {/* ── IIC × NSTA badge — on outer container so touch coords are never rotated ── */}
            {isYouTube && (
                <div
                    onPointerDown={e => {
                        if (editMode) {
                            e.stopPropagation();
                            isDragging.current = true;
                            dragRef.current = { startX: e.clientX, startY: e.clientY, initBottom: badgeBottom, initRight: badgeRight };
                            (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        } else {
                            e.stopPropagation();
                        }
                    }}
                    onTouchStart={e => { e.stopPropagation(); }}
                    onTouchEnd={e => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (!editMode) showTopBar();
                    }}
                    onClick={e => {
                        e.stopPropagation();
                        if (!editMode) showTopBar();
                    }}
                    onContextMenu={e => e.preventDefault()}
                    style={{
                        position: 'absolute',
                        bottom: `${badgeBottom}%`,
                        right:  `${badgeRight}%`,
                        zIndex: 60,
                        pointerEvents: 'all',
                        cursor: editMode ? 'move' : 'pointer',
                        background: editMode ? 'rgba(99,102,241,0.9)' : 'rgba(8,8,18,0.95)',
                        border: editMode ? '2px dashed #a5b4fc' : '1.5px solid rgba(99,102,241,0.6)',
                        borderRadius: 7,
                        padding: '6px 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        userSelect: 'none',
                        minWidth: 90,
                        boxShadow: editMode ? '0 0 16px rgba(99,102,241,0.7)' : '0 2px 10px rgba(0,0,0,0.5)',
                        touchAction: 'none',
                    }}
                >
                    <span style={{ fontSize: badgeFontSize, fontWeight: 900, letterSpacing: '0.06em', color: '#a5b4fc', fontFamily: 'sans-serif', lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {badgeText}
                    </span>
                </div>
            )}

            {/* ── TOP BAR OVERLAY — appears when badge is tapped ── */}
            {isYouTube && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    zIndex: 55,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
                    padding: '10px 14px 28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    pointerEvents: topBarVisible ? 'all' : 'none',
                    opacity: topBarVisible ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                }}>
                    {/* Left: Back button + IIC branding */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {(onBack || onBrandingClick) && (
                            <button
                                onPointerDown={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); onBack ? onBack() : onBrandingClick?.(); }}
                                style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: 'rgba(255,255,255,0.15)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', backdropFilter: 'blur(4px)',
                                    flexShrink: 0,
                                }}
                                title="Back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        {brandingLogo && (
                            <img src={brandingLogo} alt="" style={{ height: 22, width: 'auto', objectFit: 'contain', opacity: 0.9 }} />
                        )}
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#e2e8f0', fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>
                            {badgeText}
                        </span>
                    </div>

                </div>
            )}

            {/* ── Branding logo (portrait mode only) ── */}
            {brandingLogo && !rotated && (
                <img src={brandingLogo} alt=""
                    style={{
                        position: 'absolute', top: 8, left: 8, zIndex: 30,
                        height: 20, width: 'auto', objectFit: 'contain',
                        opacity: 0.6, pointerEvents: 'none',
                    }}
                />
            )}

            {/* ── ADMIN: Edit panel ── */}
            {isAdmin && isYouTube && (
                <div style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 70,
                    display: 'flex', flexDirection: 'column', gap: 5,
                    alignItems: 'flex-end', pointerEvents: 'all',
                }}>
                    <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => {
                            e.stopPropagation();
                            if (editMode) {
                                const msg = `🔄 Badge → bottom:${badgeBottom.toFixed(1)}%, right:${badgeRight.toFixed(1)}%`;
                                setSaveMsg(msg);
                                setEditMode(false);
                                onBadgePosChange?.({
                                    portrait:  { bottom: badgeBottom, right: badgeRight },
                                    landscape: { bottom: badgeBottom, right: badgeRight },
                                    fsButton:  { bottom: 5, right: 3 },
                                });
                                setTimeout(() => setSaveMsg(''), 12000);
                            } else {
                                setSaveMsg('');
                                setEditMode(true);
                            }
                        }}
                        style={{
                            background: editMode ? '#22c55e' : 'rgba(0,0,0,0.65)',
                            border: editMode ? '1.5px solid #86efac' : '1.5px solid rgba(255,255,255,0.25)',
                            borderRadius: 8, color: '#fff',
                            padding: '6px 12px', fontSize: 12, fontWeight: 800,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                            backdropFilter: 'blur(6px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {editMode ? '💾 Save & Lock' : '✏️ Edit Badge'}
                    </button>

                    {editMode && (
                        <div style={{
                            background: 'rgba(0,0,0,0.85)',
                            border: '1px solid rgba(99,102,241,0.5)',
                            borderRadius: 8, padding: '7px 10px', fontSize: 11,
                            fontWeight: 700, color: '#e2e8f0',
                            backdropFilter: 'blur(6px)', lineHeight: 1.8,
                            pointerEvents: 'none', minWidth: 170,
                        }}>
                            <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 2 }}>🔄 Badge — drag karein</div>
                            <div><span style={{ color: '#a5b4fc' }}>bottom: </span><span style={{ color: '#fde68a', fontFamily: 'monospace' }}>{badgeBottom.toFixed(1)}%</span></div>
                            <div><span style={{ color: '#a5b4fc' }}>right: </span><span style={{ color: '#fde68a', fontFamily: 'monospace' }}>{badgeRight.toFixed(1)}%</span></div>
                        </div>
                    )}

                    {saveMsg && !editMode && (
                        <div style={{
                            background: '#0f172a', border: '1px solid #22c55e',
                            color: '#a5f3fc', borderRadius: 8, padding: '7px 10px',
                            fontSize: 11, fontWeight: 700, maxWidth: 220,
                            lineHeight: 1.7, whiteSpace: 'pre-wrap',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
                        }}>
                            ✅ Saved!{'\n'}
                            <span style={{ color: '#fde68a', fontFamily: 'monospace', fontSize: 10 }}>{saveMsg}</span>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};
