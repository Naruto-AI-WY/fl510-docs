// Mermaid initialization script
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Mermaid to load
    function initMermaid() {
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                themeVariables: {
                    primaryColor: '#1976d2',
                    primaryTextColor: '#ffffff',
                    primaryBorderColor: '#1976d2',
                    lineColor: '#1976d2',
                    secondaryColor: '#f5f5f5',
                    tertiaryColor: '#ffffff'
                },
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true
                }
            });
            
            // Render all mermaid diagrams
            mermaid.run();
        } else {
            // Retry after a short delay
            setTimeout(initMermaid, 100);
        }
    }
    
    // Start initialization
    initMermaid();
});
