import React from 'react';

interface LogoProps {
    className?: string;
    iconOnly?: boolean;
    animated?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Logo: React.FC<LogoProps> = ({
    className = '',
    iconOnly = false,
    animated = true,
    size = 'md'
}) => {

    const sizeClasses = {
        sm: 'h-8',
        md: 'h-12',
        lg: 'h-20',
        xl: 'h-28'
    };

    const textSizeClasses = {
        sm: 'text-lg',
        md: 'text-3xl',
        lg: 'text-5xl',
        xl: 'text-7xl'
    };

    return (
        <div className={`flex items-center gap-3 select-none ${className}`}>
            {/* Logo Image */}
            <div className={`relative ${sizeClasses[size]} aspect-square`}>
                <div className={`absolute inset-0 bg-emerald-500/20 rounded-full blur-xl ${animated ? 'animate-pulse' : ''}`} />
                <img
                    src="/aura-logo.png"
                    alt="Aura Logo"
                    className="relative z-10 w-full h-full object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                />
            </div>

            {/* Text Logo (Optional) */}
            {!iconOnly && (
                <div className="flex flex-col justify-center">
                    <h1 className={`${textSizeClasses[size]} font-black tracking-tighter text-white leading-none`}>
                        Au<span className="text-emerald-500">ra</span>
                    </h1>
                </div>
            )}
        </div>
    );
};

export default Logo;
