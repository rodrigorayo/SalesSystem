import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
}

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage
}: PaginationProps) {
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    
    // Simple windowing for page numbers to avoid too many buttons
    let visiblePages = pages;
    if (totalPages > 5) {
        if (currentPage <= 3) {
            visiblePages = [...pages.slice(0, 5)];
        } else if (currentPage >= totalPages - 2) {
            visiblePages = [...pages.slice(totalPages - 5, totalPages)];
        } else {
            visiblePages = [...pages.slice(currentPage - 3, currentPage + 2)];
        }
    }

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-gray-100 mt-4">
            <span className="text-sm text-gray-500">
                Mostrando <span className="font-medium text-gray-900">{startItem}</span> a <span className="font-medium text-gray-900">{endItem}</span> de <span className="font-medium text-gray-900">{totalItems}</span> resultados
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                
                {visiblePages[0] > 1 && (
                    <>
                        <button onClick={() => onPageChange(1)} className="w-8 h-8 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">1</button>
                        {visiblePages[0] > 2 && <span className="text-gray-400">...</span>}
                    </>
                )}
                
                {visiblePages.map(page => (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                            currentPage === page 
                                ? 'bg-indigo-600 text-white' 
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {page}
                    </button>
                ))}

                {visiblePages[visiblePages.length - 1] < totalPages && (
                    <>
                        {visiblePages[visiblePages.length - 1] < totalPages - 1 && <span className="text-gray-400">...</span>}
                        <button onClick={() => onPageChange(totalPages)} className="w-8 h-8 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">{totalPages}</button>
                    </>
                )}

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
}
