// Replace with your actual API key
const API_KEY = 'AIzaSyDjfCGhmw-oAZbDQf-lCo8-fJJr5ARA-SU';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Configure marked.js for better formatting
marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: true,
    smartLists: true,
    smartypants: true,
    highlight: function(code, lang) {
        return hljs.highlightAuto(code).value;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let pdfContent = null;
    let isProcessing = false;

    // DOM Elements
    const fileUpload = document.querySelector('.file-upload__input');
    const uploadLabel = document.querySelector('.file-upload__label');
    const actionButtons = document.querySelectorAll('.action-button');
    const loadingOverlay = document.querySelector('.loading-overlay');
    const resultSection = document.querySelector('.result-section');
    const header = document.querySelector('.header');

    // File Upload Handling
    fileUpload.addEventListener('change', handleFileUpload);
    setupDragAndDrop();

    // Action Button Events
    actionButtons.forEach(button => {
        button.addEventListener('click', () => handleActionButtonClick(button.dataset.action));
        setupButtonHoverEffect(button);
    });

    // Scroll Effects
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = (e) => {
                pdfContent = e.target.result.split(',')[1];
                updateUploadLabel(file.name);
                animateUploadSuccess();
            };
            reader.readAsDataURL(file);
        } else {
            showNotification('Please upload a PDF file.', 'error');
        }
    }

    function updateUploadLabel(fileName) {
        const nameElement = document.querySelector('.file-upload__name');
        if (nameElement) {
            nameElement.textContent = fileName;
            nameElement.style.color = 'var(--color-primary)';
        }
    }

    function setupDragAndDrop() {
        const dropZone = document.querySelector('.upload-section');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        dropZone.addEventListener('drop', handleDrop, false);

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight() {
            dropZone.classList.add('drag-active');
        }

        function unhighlight() {
            dropZone.classList.remove('drag-active');
        }

        function handleDrop(e) {
            const file = e.dataTransfer.files[0];
            if (file) {
                fileUpload.files = e.dataTransfer.files;
                handleFileUpload({ target: { files: [file] } });
            }
        }
    }

    async function handleActionButtonClick(action) {
        if (!pdfContent) {
            showNotification('Please upload a PDF file first.', 'warning');
            return;
        }

        if (isProcessing) {
            showNotification('Please wait for the current process to complete.', 'warning');
            return;
        }

        isProcessing = true;
        showLoadingOverlay();

        try {
            const prompt = getPrompt(action);
            const response = await getGeminiResponse(prompt, pdfContent);
            hideLoadingOverlay();
            displayResults(formatResponse(response, action), action);
        } catch (error) {
            console.error('Error occurred:', error);
            showNotification(`An error occurred while processing your request. Please try again.`, 'error');
            hideLoadingOverlay();
        } finally {
            isProcessing = false;
        }
    }

    function getPrompt(action) {
        const basePrompt = {
            summary: `Analyze the provided PDF and create a comprehensive, well-structured summary following this exact format:

# Overview
[2-3 sentences introducing the main topic]

## Detailed Analysis
### [Topic 1]
[ Detailed explanation ]

### [Topic 2]
[Detailed explanation]

[Continue for all topics]

## Conclusion
[Brief summary of key takeaways]

Note: Ensure proper markdown formatting with clear headings and subheadings.`,

            questions: `Create 5 comprehensive exam questions based on the PDF content using this exact format:

# Question 1

[Clear, challenging question that tests deep understanding]

## Model Answer
[Detailed 100+ word answer demonstrating thorough knowledge]

---

[Repeat format for Questions 2-5]

Note: Questions should cover different topics and require detailed explanations and each question paper should only have 5 questions.`
            ,

            paper: `Create a formal examination paper using this exact format:

# [Subject Name] Examination
Time: 3 hours
Maximum Marks: 100

## Instructions:
- Answer all questions
- Each question carries 20 marks
- Write detailed answers with proper explanations

## Questions

### 1.
a) [Sub-question] [8 marks]
b) [Sub-question] [8 marks]
c) [Sub-question] [6 marks]

[Continue format anf sub question arrangement for questions 2-5 ]

Note: Ensure clear marking scheme and professional formatting.`
        };

        return basePrompt[action] || '';
    }

    async function getGeminiResponse(prompt, pdfContent) {
        const requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'application/pdf', data: pdfContent } }
                ]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 1,
                topP: 1,
                maxOutputTokens: 8192,
                stopSequences: []
            }
        };

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error('Failed to generate response');
        }

        const data = await response.json();

        if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format');
        }

        return data.candidates[0].content.parts[0].text;
    }

    async function getDetailedExplanation(topic, pdfContent) {
        const detailedPrompt = `Provide a comprehensive, in-depth explanation of "${topic}" from the PDF content. Include:
        a ver highly detailed and extensive explanation of the selected topic where every single sub part of that topic is explained in great detail
        Format the response using proper markdown with clear sections and subsections.`;

        try {
            const response = await getGeminiResponse(detailedPrompt, pdfContent);
            return formatResponse(response, 'detailed');
        } catch (error) {
            console.error('Error getting detailed explanation:', error);
            throw error;
        }
    }

    function formatResponse(response, action) {
        let formattedResponse = response
            .replace(/\n{3,}/g, '\n\n')
            .replace(/(?<!#)#(?!#)/g, '##')
            .trim();

        switch (action) {
            case 'summary':
                formattedResponse = `# Document Summary\n\n${formattedResponse}`;
                break;
            case 'questions':
                formattedResponse = `# Practice Questions\n\n${formattedResponse}`;
                break;
            case 'paper':
                formattedResponse = `# Examination Paper\n\n${formattedResponse}`;
                break;
        }

        return formattedResponse;
    }

    function displayResults(response, action) {
        resultSection.innerHTML = '';

        if (!response) {
            showNotification('No valid response received. Please try again.', 'error');
            return;
        }

        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';

        const formattedContent = marked.parse(response, {
            headerIds: true,
            mangle: false
        });

        resultCard.innerHTML = `
            <h3 class="result-card__title">${getActionTitle(action)}</h3>
            <div class="result-content">${formattedContent}</div>
            <div class="result-actions">
                <button class="copy-button">
                    <i class="fas fa-copy"></i> Copy Results
                </button>
                <button class="download-button">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        `;

        // Add detailed explanation container
        const detailContainer = document.createElement('div');
        detailContainer.className = 'detail-container';
        detailContainer.style.display = 'none';
        resultCard.appendChild(detailContainer);

        resultSection.appendChild(resultCard);

        // Add click handlers for headings if this is a summary
        if (action === 'summary') {
            setupHeadingInteractivity(resultCard);
        }

        // Show results section with animation
        resultSection.style.display = 'block';
        gsap.from(resultCard, {
            opacity: 0,
            y: 30,
            duration: 0.5,
            ease: 'power2.out'
        });

        // Scroll to results
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Setup action buttons
        setupCopyButton(resultCard.querySelector('.copy-button'), response);
        setupDownloadButton(resultCard.querySelector('.download-button'), response, action);
    }

    function setupHeadingInteractivity(resultCard) {
        const headings = resultCard.querySelectorAll('h2, h3');
        const detailContainer = resultCard.querySelector('.detail-container');
        let activeHeading = null;

        headings.forEach(heading => {
            heading.style.cursor = 'pointer';
            heading.classList.add('interactive-heading');

            heading.addEventListener('click', async () => {
                try {
                    if (activeHeading === heading) {
                        if (detailContainer.style.display === 'none') {
                            showDetailContainer(heading);
                        } else {
                            hideDetailContainer();
                        }
                    } else {
                        showDetailContainer(heading);
                    }
                    activeHeading = heading;
                } catch (error) {
                    showNotification('Failed to load detailed explanation.', 'error');
                }
            });
        });

        async function showDetailContainer(heading) {
            detailContainer.innerHTML = `
                <div class="detail-loading">
                    <div class="spinner"></div>
                    <p>Loading detailed explanation...</p>
                </div>
            `;
            detailContainer.style.display = 'block';

            gsap.fromTo(detailContainer,
                { opacity: 0, y: -20 },
                { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
            );

            try {
                const detailedContent = await getDetailedExplanation(heading.textContent, pdfContent);

                detailContainer.innerHTML = `
                    <div class="detail-content">
                        <div class="detail-header">
                            <h4>Detailed Explanation: ${heading.textContent}</h4>
                            <button class="close-detail">×</button>
                        </div>
                        <div class="detail-body">
                            ${marked.parse(detailedContent)}
                        </div>
                    </div>
                `;

                const closeButton = detailContainer.querySelector('.close-detail');
                closeButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideDetailContainer();
                });

                detailContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (error) {
                detailContainer.innerHTML = `
                    <div class="detail-error">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Failed to load detailed explanation. Please try again.</p>
                    </div>
                `;
            }
        }

        function hideDetailContainer() {
            gsap.to(detailContainer, {
                opacity: 0,
                y: -20,
                duration: 0.3,
                ease: 'power2.in',
                onComplete: () => {
                    detailContainer.style.display = 'none';
                    detailContainer.innerHTML = '';
                    activeHeading = null;
                }
            });
        }
    }

    function getActionTitle(action) {
        const titles = {
            'summary': 'Document Summary',
            'questions': 'Practice Questions',
            'paper': 'Examination Paper'
        };
        return titles[action] || 'Results';
    }

    function setupCopyButton(button, content) {
        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(content);
                showNotification('Content copied to clipboard!', 'success');
            } catch (err) {
                showNotification('Failed to copy content.', 'error');
            }
        });
    }

    function setupDownloadButton(button, content, action) {
        button.addEventListener('click', () => {
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${action}-${new Date().toISOString().split('T')[0]}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification('File downloaded successfully!', 'success');
        });
    }

    function setupButtonHoverEffect(button) {
        button.addEventListener('mouseenter', () => {
            gsap.to(button, {
                scale: 1.02,
                duration: 0.2,
                ease: 'power2.out'
            });
        });

        button.addEventListener('mouseleave', () => {
            gsap.to(button, {
                scale: 1,
                duration: 0.2,
                ease: 'power2.in'
            });
        });
    }

    function showLoadingOverlay() {
        loadingOverlay.style.display = 'flex';
        gsap.to(loadingOverlay, {
            opacity: 1,
            duration: 0.3,
            ease: 'power2.out'
        });
    }

    function hideLoadingOverlay() {
        gsap.to(loadingOverlay, {
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in',
            onComplete: () => {
                loadingOverlay.style.display = 'none';
            }
        });
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.innerHTML = `
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        gsap.fromTo(notification,
            { opacity: 0, y: 20, right: -300 },
            { opacity: 1, y: 0, right: 20, duration: 0.5, ease: 'power2.out' }
        );

        setTimeout(() => {
            gsap.to(notification, {
                opacity: 0,
                y: 20,
                right: -300,
                duration: 0.5,
                ease: 'power2.in',
                onComplete: () => notification.remove()
            });
        }, 3000);
    }

    function getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle'
        };
        return icons[type] || 'info-circle';
    }

    function animateUploadSuccess() {
        gsap.to(uploadLabel, {
            backgroundColor: 'var(--color-success)',
            duration: 0.3,
            yoyo: true,
            repeat: 1
        });
    }
});

// Add these styles to your CSS
const styles = `
    .interactive-heading {
        position: relative;
        padding-left: 20px;
        transition: color 0.3s ease;
    }

    .interactive-heading:before {
        content: '›';
        position: absolute;
        left: 0;
        transition: transform 0.3s ease;
    }

    .interactive-heading:hover {
        color: var(--color-primary);
    }

    .interactive-heading.active:before {
        transform: rotate(90deg);
    }

    .detail-container {
        margin: 20px 0;
        border-radius: 8px;
        background: var(--color-background-light);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .detail-content {
        padding: 20px;
    }

    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--color-border);
    }

    .close-detail {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--color-text);
        padding: 0 8px;
        transition: color 0.3s ease;
    }

    .close-detail:hover {
        color: var(--color-primary);
    }

    .detail-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        gap: 10px;
    }

    .detail-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        color: var(--color-error);
        gap: 10px;
    }

    .spinner {
        width: 30px;
        height: 30px;
        border: 3px solid var(--color-background);
        border-top: 3px solid var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

// Add the styles to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);