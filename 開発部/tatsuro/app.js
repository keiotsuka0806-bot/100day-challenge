const revealTargets = document.querySelectorAll('.reveal');
const signupForm = document.querySelector('#signupForm');
const formNote = document.querySelector('#formNote');

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.18,
  rootMargin: '0px 0px -8% 0px',
});

revealTargets.forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
  observer.observe(element);
});

signupForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const email = String(formData.get('email') || '').trim();

  if (!email) {
    formNote.textContent = 'メールアドレスを入力してください。';
    return;
  }

  formNote.textContent = '受け付けました。静かな案内をお送りします。';
  signupForm.reset();
});
