// Mermaid initialization script
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Mermaid
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
            startOnLoad: true,
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
    }
});
