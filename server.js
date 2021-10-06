const express = require('express')
const pinataSDK = require('@pinata/sdk')
const fs = require('fs')

const cors = require('cors')
const multer = require('multer')


const app = express()
const port = process.env.PORT || 8080


app.listen(port, () => {
    console.log(`App is listening at ${port}`)
})

const PinataKeys = require("./PinataKeys")

const pinata = pinataSDK(process.env.PINATA_API_KEY || PinataKeys.API_KEY, process.env.PINATA_SECRET_KEY || PinataKeys.API_SECRET)

const upload = multer({ dest: "uploads/" })

app.use(cors())
app.use(express.json({ limit: "50mb" }))

app.use(
    express.urlencoded({
        limit: "50mb",
        extended: true,
        parameterLimit: 5000
    })
)

app.post("/mint", upload.single("image"), async (req, res) => {
    const multerReq = req

    if (!multerReq.file) {
        res.status(500).json({ status: false, msg: "no file provided" })
    } else {
        const fileName = multerReq.file.filename
        await pinata.testAuthentication().catch(err => res.status(500).json(JSON.stringify(err)))
        const readableStreamForFile = fs.createReadStream(`./uploads/${fileName}`)

        const options = {
            pinataMetadata: {
                name: req.body.title.replace(/\s/g, "-"),
                keyValues: {
                    description: req.body.description
                }
            }
        }

        const pinnedFile = await pinata.pinFileToIPFS(readableStreamForFile, options)

        if (pinnedFile.IpfsHash && pinnedFile.PinSize > 0) {
            fs.unlinkSync(`./uploads/${fileName}`)

            const metadata = {
                name: req.body.title,
                description: req.body.description,
                symbol: "TUT",
                artifactUrl: `ipfs://${pinnedFile.IpfsHash}`,
                displayUrl: `ipfs://${pinnedFile.IpfsHash}`,
                creators: [req.body.creator],
                decimals: 0,
                thumbnailUrl: "https://tezostaquito.io/img/favicon.png",
                is_transferable: true,
                shouldPreferSymbol: false
            }

            const pinnedMetadata = await pinata.pinJSONToIPFS(metadata, {
                pinataMetadata: {
                    name: "TUT-metadata"
                }
            })

            if (pinnedMetadata.IpfsHash && pinnedMetadata.PinSize > 0) {
                res.status(200).json({
                    status: true,
                    msg: {
                        imageHash: pinnedFile.IpfsHash,
                        metadataHash: pinnedMetadata.IpfsHash
                    }
                });
            }
        }
    }
})