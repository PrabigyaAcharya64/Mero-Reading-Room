import { db, functions } from '../../lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';

// ============================================
// Business Details
// ============================================
const businessDetails = {
    logo: 'https://iili.io/f4hpEYP.png',
    name: 'Mero Reading Room',
    phone: '9867666655',
    address: 'Mid Baneshwor, Kathmandu, Nepal',
    email: 'meroreading@gmail.com',
    currency: 'Rs'
};

// ============================================
// PDF Styles
// ============================================
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 12,
        fontFamily: 'Helvetica',
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        paddingBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#000000',
    },
    headerLeft: {
        flexDirection: 'column',
    },
    headerRight: {
        flexDirection: 'column',
        alignItems: 'flex-end',
    },
    logo: {
        width: 120,
        height: 40,
        marginBottom: 10,
    },
    businessInfo: {
        fontSize: 10,
        lineHeight: 1.5,
        color: '#000000',
    },
    businessName: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    invoiceLabel: {
        fontSize: 32,
        fontFamily: 'Helvetica-Bold',
        letterSpacing: -1,
        marginBottom: 5,
    },
    invoiceNumber: {
        fontSize: 12,
        marginTop: 5,
    },
    invoiceDate: {
        fontSize: 12,
        color: '#666666',
        marginTop: 3,
    },
    infoSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 30,
        marginBottom: 40,
    },
    infoLeft: {
        flexDirection: 'column',
        width: '48%',
    },
    infoRight: {
        flexDirection: 'column',
        width: '48%',
        alignItems: 'flex-end',
    },
    sectionTitle: {
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        color: '#666666',
        marginBottom: 10,
        fontFamily: 'Helvetica-Bold',
    },
    customerName: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 4,
    },
    customerDetails: {
        fontSize: 12,
        color: '#444444',
        lineHeight: 1.6,
    },
    paymentStatus: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
    },
    paymentDate: {
        fontSize: 11,
        color: '#666666',
        marginTop: 5,
    },
    table: {
        marginTop: 30,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingBottom: 12,
        paddingTop: 12,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eeeeee',
        paddingBottom: 15,
        paddingTop: 15,
    },
    tableHeaderText: {
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontFamily: 'Helvetica-Bold',
    },
    tableCell: {
        fontSize: 12,
    },
    tableCellBold: {
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
    },
    col1: {
        width: '50%',
    },
    col2: {
        width: '15%',
        textAlign: 'center',
    },
    col3: {
        width: '17.5%',
        textAlign: 'right',
    },
    col4: {
        width: '17.5%',
        textAlign: 'right',
    },
    totalsSection: {
        marginTop: 30,
        alignItems: 'flex-end',
    },
    totalsTable: {
        width: 250,
    },
    totalsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    totalLabel: {
        fontSize: 12,
    },
    totalAmount: {
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 2,
        borderTopColor: '#000000',
        marginTop: 5,
    },
    grandTotalLabel: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
    },
    grandTotalAmount: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
    },
    footer: {
        marginTop: 80,
        fontSize: 11,
        color: '#666666',
        lineHeight: 1.6,
    },
    footerTitle: {
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
        marginBottom: 5,
    },
});


const InvoiceDocument = ({ userData, transactionData, invoiceNumber }) => {
    const invoiceDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const packageName = transactionData.details ||
        `${transactionData.roomType === 'ac' ? 'AC' : 'Non-AC'} Reading Room Package`;

    const paymentDate = new Date(transactionData.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header Section */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Image src={businessDetails.logo} style={styles.logo} />
                        <View style={styles.businessInfo}>
                            <Text style={styles.businessName}>{businessDetails.name}</Text>
                            <Text>{businessDetails.address}</Text>
                            <Text>{businessDetails.phone}</Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.invoiceLabel}>INVOICE</Text>
                        <Text style={styles.invoiceNumber}># {invoiceNumber}</Text>
                        <Text style={styles.invoiceDate}>{invoiceDate}</Text>
                    </View>
                </View>

                {/* Bill To / Payment Status Section */}
                <View style={styles.infoSection}>
                    <View style={styles.infoLeft}>
                        <Text style={styles.sectionTitle}>BILL TO</Text>
                        <Text style={styles.customerName}>{userData.name || 'N/A'}</Text>
                        <View style={styles.customerDetails}>
                            <Text>{userData.email || 'N/A'}</Text>
                            <Text>{userData.phoneNumber || 'N/A'}</Text>
                            {userData.mrrNumber && <Text>MRR ID: {userData.mrrNumber}</Text>}
                        </View>
                    </View>
                    <View style={styles.infoRight}>
                        <Text style={styles.sectionTitle}>PAYMENT STATUS</Text>
                        <Text style={styles.paymentStatus}>PAID</Text>
                        <Text style={styles.paymentDate}>{paymentDate}</Text>
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, styles.col1]}>Description</Text>
                        <Text style={[styles.tableHeaderText, styles.col2]}>Qty</Text>
                        <Text style={[styles.tableHeaderText, styles.col3]}>Unit Price</Text>
                        <Text style={[styles.tableHeaderText, styles.col4]}>Total</Text>
                    </View>

                    {/* Table Row */}
                    <View style={styles.tableRow}>
                        <Text style={[styles.tableCellBold, styles.col1]}>{packageName}</Text>
                        <Text style={[styles.tableCell, styles.col2]}>1</Text>
                        <Text style={[styles.tableCell, styles.col3]}>
                            {businessDetails.currency} {transactionData.amount.toFixed(2)}
                        </Text>
                        <Text style={[styles.tableCell, styles.col4]}>
                            {businessDetails.currency} {transactionData.amount.toFixed(2)}
                        </Text>
                    </View>
                </View>

                {/* Totals Section */}
                <View style={styles.totalsSection}>
                    <View style={styles.totalsTable}>
                        <View style={styles.totalsRow}>
                            <Text style={styles.totalLabel}>Subtotal</Text>
                            <Text style={styles.totalAmount}>
                                {businessDetails.currency} {transactionData.amount.toFixed(2)}
                            </Text>
                        </View>
                        <View style={styles.grandTotalRow}>
                            <Text style={styles.grandTotalLabel}>TOTAL</Text>
                            <Text style={styles.grandTotalAmount}>
                                {businessDetails.currency} {transactionData.amount.toFixed(2)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerTitle}>Notes:</Text>
                    <Text>This is a computer-generated invoice.</Text>
                    <Text>Thank you for choosing Mero Reading Room. We appreciate your support.</Text>
                </View>
            </Page>
        </Document>
    );
};


async function generatePDFBase64(userData, transactionData, invoiceNumber) {
    try {
        const blob = await pdf(
            <InvoiceDocument
                userData={userData}
                transactionData={transactionData}
                invoiceNumber={invoiceNumber}
            />
        ).toBlob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Remove the data URL prefix to get just the base64 string
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}


async function sendInvoiceEmail(userData, transactionData, invoiceBase64, invoiceNumber, transactionId) {
    try {
        // Call Cloud Function to send email securely and SAVE the invoice
        const sendEmailFn = httpsCallable(functions, 'sendInvoiceEmail');

        const result = await sendEmailFn({
            userData: {
                name: userData.name,
                email: userData.email
            },
            invoiceData: {
                invoiceNumber: invoiceNumber,
                amount: transactionData.amount,
                details: transactionData.details,
                roomType: transactionData.roomType
            },
            pdfBase64: invoiceBase64,
            transactionId: transactionId // MUST pass this now
        });

        return result.data;
    } catch (error) {
        console.error('Email sending error:', error);
        throw error;
    }
}

// ============================================
// Save Invoice to Firebase
// ============================================
// Note: saveInvoiceToFirebase removed as it's now handled by Cloud Function for security.


// ============================================
// Main Function: Generate and Send Invoice
// ============================================
export async function generateAndSendInvoice(userId, transactionId) {
    try {
        // 1. Fetch user data from Firebase
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
            throw new Error('User not found');
        }

        const userData = userSnap.data();

        // 2. Fetch transaction data from Firebase
        const transactionDocRef = doc(db, 'transactions', transactionId);
        const transactionSnap = await getDoc(transactionDocRef);

        if (!transactionSnap.exists()) {
            throw new Error('Transaction not found');
        }

        const transactionData = transactionSnap.data();

        // 3. Generate invoice number
        const invoiceNumber = `INV-${Date.now()}`;

        // 4. Generate PDF as Base64
        const pdfBase64 = await generatePDFBase64(userData, transactionData, invoiceNumber);

        // 5. Send email via Brevo and Save to Firestore (Server-side)
        const emailResult = await sendInvoiceEmail(userData, transactionData, pdfBase64, invoiceNumber, transactionId);

        return {
            success: true,
            invoiceNumber: invoiceNumber,
            invoiceId: emailResult.invoiceId,
            message: 'Invoice sent to ' + userData.email
        };

    } catch (error) {
        console.error('Error in generateAndSendInvoice:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================
// Export Invoice Document Component for Reuse
// ============================================
export { InvoiceDocument };
