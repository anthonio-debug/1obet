const calculateSessionNo = (type, over) => {
  let divider = 5
  let sessionNo = 0
  if (type === 'TEST') {
    divider = 10
  }
  if (over % divider === 0) {
    sessionNo = over / divider;
  } else {
    sessionNo = Math.floor(over / divider) + 1;
  }
  return sessionNo
}
