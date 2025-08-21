import bcrypt from "bcrypt"

async function generatePasswordHash() {
  const password = "123"
  const saltRounds = 12

  try {
    const hash = await bcrypt.hash(password, saltRounds)
    console.log("Password hash:", hash)
    console.log("Add this to your .env file as ADMIN_PASSWORD_HASH")
  } catch (error) {
    console.error("Error generating hash:", error)
  }
}

generatePasswordHash()