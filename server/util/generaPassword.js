const generaPassword = (lunghezza = 12)  =>{
  const caratteri = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < lunghezza; i++) {
    const randomIndex = Math.floor(Math.random() * caratteri.length);
    password += caratteri[randomIndex];
  }
  return password;
}

module.exports = generaPassword;   