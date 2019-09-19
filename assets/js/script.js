document.addEventListener('DOMContentLoaded', () => {
  const pic = document.querySelector('.profile-picture');
  const modal = document.querySelector('.modal');

  modal.style.visibility = 'hidden'; // set it as inline style

  const toggleModalVisibility = () => {
    if (modal.style.visibility === 'hidden') {
      modal.style.visibility = 'visible';
    } else {
      modal.style.visibility = 'hidden';
    }
  }

  pic.addEventListener('click', () => {
    toggleModalVisibility();
  });

  modal.addEventListener('click', () => {
    toggleModalVisibility();
  });

});
