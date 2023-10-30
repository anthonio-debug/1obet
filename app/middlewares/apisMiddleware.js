function checkAccess(req, res, next, jsonApis) {
	let url = req.url
	url = url.replace('/api/', '')
	// console.log(url)
	url = url.split('/')[0]
	url = url.split('?')[0]
	// console.log("hello", url)
	// res.json(jsonApis)
	if (jsonApis.includes(url)){
		// console.log("check", url)
		next()
	}
	else {
		return res.status(404).send({ message: "api not found" })
	}
}

module.exports = checkAccess