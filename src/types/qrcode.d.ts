// Minimal typings for the part of `qrcode` the deployments page uses.
declare module "qrcode" {
    interface QRCodeToDataURLOptions {
        width?: number;
        margin?: number;
        errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    }
    export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
    const QRCode: { toDataURL: typeof toDataURL };
    export default QRCode;
}
