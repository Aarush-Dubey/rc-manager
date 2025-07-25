
import { getUploadAuthParams } from "@imagekit/next/server"

export async function GET() {
    // Your application logic to authenticate the user could go here.
    // For this demo, we'll assume the user is authenticated.

    if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY) {
        return Response.json({ error: "ImageKit keys are not configured." }, { status: 500 });
    }

    // Generate a unique token for each request to prevent replay attacks
    const token = crypto.randomUUID();

    const { expire, signature } = getUploadAuthParams({
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
        publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY as string,
        token: token,
    })

    return Response.json({ token, expire, signature })
}
