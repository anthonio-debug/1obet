const cron = require("node-cron");
const Settings = require("../app/models/settings");




const updateDefaultTheme = async () => {
  try {
    const settings = await Settings.findOne({
      _id: "645e27d8ba117017eb29bad8",
    });
    const currentTheme = settings.defaultThemeName;
    console.log("current theme", currentTheme);
    let updatedTheme;

    if (currentTheme == "light-theme") {
      updatedTheme = "dark-theme";
    } else if (currentTheme == "dark-theme") {
      updatedTheme = "grey-theme";
    } else {
      updatedTheme = "light-theme";
    }

    // Update the default theme
    settings.defaultThemeName = updatedTheme;
    await settings.save();
    console.log("Default theme updated:", settings.defaultThemeName);
  } catch (err) {
    console.error(err);
  }
};

const updateDefaultLoginPage = async () => {
  try {
    const settings = await Settings.findOne({
      _id: "642bff9fc9bb7f4cb5b35d0a",
    });
    const currentLoginPage = settings.defaultLoginPage;
    console.log("current LoginPage", currentLoginPage);
    let updatedLoginPage;

    if (currentLoginPage == "login-page-one") {
      updatedLoginPage = "login-page-two";
    } else if (currentLoginPage == "login-page-two") {
      updatedLoginPage = "login-page-three";
    } else {
      updatedLoginPage = "login-page-one";
    }

    // Update the default login page
    settings.defaultLoginPage = updatedLoginPage;
    await settings.save();
    console.log("Default loginPage updated:", settings.defaultLoginPage);
  } catch (err) {
    console.error(err);
  }
};


const themeCronJob = () => {
  cron.schedule('* * * * *',  () => {
    updateDefaultTheme();
    console.log("theme Cron Job is running");
    updateDefaultLoginPage();
  });
};

// module.export = themeCronJob