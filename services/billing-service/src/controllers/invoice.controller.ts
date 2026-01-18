import { Request, Response } from 'express';
import { Invoice } from '../models';
import { logger } from '../utils/logger';

export const invoiceController = {
    // List invoices
    async list(req: Request, res: Response) {
        try {
            const orgId = req.query.organizationId as string;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const skip = (page - 1) * limit;

            const [invoices, total] = await Promise.all([
                Invoice.find({ organizationId: orgId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Invoice.countDocuments({ organizationId: orgId }),
            ]);

            res.json({
                success: true,
                data: {
                    items: invoices,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('List invoices error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invoices' },
            });
        }
    },

    // Get invoice by ID
    async getById(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const invoice = await Invoice.findById(id).lean();

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Invoice not found' },
                });
            }

            res.json({
                success: true,
                data: invoice,
            });
        } catch (error) {
            logger.error('Get invoice error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invoice' },
            });
        }
    },

    // Download PDF
    async downloadPdf(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const invoice = await Invoice.findById(id);

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Invoice not found' },
                });
            }

            // TODO: Generate actual PDF
            if (invoice.pdfUrl) {
                return res.redirect(invoice.pdfUrl);
            }

            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'PDF not available' },
            });
        } catch (error) {
            logger.error('Download invoice PDF error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to download invoice' },
            });
        }
    },
};
