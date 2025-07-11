// submissions.js
export function renderSubmissions(submissions) {
  const container = document.getElementById('submissionsList');
  if (!container) return;

  container.innerHTML = '';
  submissions.forEach((submission, index) => {
    const div = document.createElement('div');
    div.className = 'submission';
    div.innerHTML = `
      <strong>${submission.name}</strong> - ${new Date(submission.submittedAt).toLocaleString()}<br/>
      <button onclick="approveSubmission(${index})">Approve</button>
      <pre>${JSON.stringify(submission.preferences, null, 2)}</pre>
    `;
    container.appendChild(div);
  });
}

export function approveSubmission(index) {
  const submissions = JSON.parse(localStorage.getItem('shiftSubmissions') || '[]');
  if (submissions[index]) {
    submissions[index].approved = true;
    localStorage.setItem('shiftSubmissions', JSON.stringify(submissions));
    alert(`Submission by ${submissions[index].name} approved.`);
  }
}
