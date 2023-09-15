const runnersPosition = [
    { runner: 9187513, amount: 11000 },
    { runner: 24823398, amount: -3000 },
    { runner: 45528849, amount: 7000 },
    { runner: 52322150, amount: -3001 },
    { runner: 37459730, amount: -3000 },
    { runner: 47883568, amount: 850 }
  ];
  
  const lowestValue = runnersPosition.reduce((min, current) => {
    return current.amount < min.amount ? current : min;
  }, runnersPosition[0]);

  console.log(" =============== lowestValue ================= ", lowestValue);