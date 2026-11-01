export default function Loading() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header Skeleton */}
            <div className="h-40 bg-gray-200 rounded-2xl w-full"></div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="h-64 bg-gray-200 rounded-2xl"></div>
                    <div className="h-64 bg-gray-200 rounded-2xl"></div>
                </div>
                <div className="space-y-6">
                    <div className="h-96 bg-gray-200 rounded-2xl"></div>
                </div>
            </div>
        </div>
    );
}
