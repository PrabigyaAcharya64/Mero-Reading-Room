import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import logo from '../../assets/logo.png';

// Create styles
const styles = StyleSheet.create({
    page: {
        padding: 40,
        backgroundColor: '#FFFFFF',
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#1f2937'
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#333',
        paddingBottom: 10,
        alignItems: 'center'
    },
    logo: {
        width: 60,
        height: 60,
        marginBottom: 10
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 5
    },
    subtitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4b5563'
    },
    table: {
        display: "flex",
        width: "auto",
        borderStyle: "solid",
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        marginBottom: 20
    },
    tableRow: {
        margin: "auto",
        flexDirection: "row"
    },
    tableColLabel: {
        width: "25%",
        borderStyle: "solid",
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        backgroundColor: '#f9fafb',
        padding: 8
    },
    tableColValue: {
        width: "25%",
        borderStyle: "solid",
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        padding: 8
    },
    cellTextLabel: {
        fontSize: 10,
        fontWeight: 'bold'
    },
    cellTextValue: {
        fontSize: 10
    },
    rulesSection: {
        marginBottom: 20
    },
    rulesTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 10
    },
    ruleItem: {
        marginBottom: 4,
        flexDirection: 'row',
        fontSize: 9,
        lineHeight: 1.4
    },
    ruleNumber: {
        width: 20,
        fontWeight: 'bold'
    },
    ruleText: {
        flex: 1
    },
    declaration: {
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center'
    },
    checkbox: {
        width: 12,
        height: 12,
        borderWidth: 1,
        borderColor: '#3b82f6',
        marginRight: 10,
        backgroundColor: '#3b82f6' // Checked style (Blue)
    },
    declarationText: {
        fontSize: 10,
        fontStyle: 'italic'
    },
    signatureSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 30
    },
    signatureBox: {
        flex: 1,
    },
    signatureLabel: {
        marginBottom: 5,
        fontWeight: 'bold',
        fontSize: 10
    },
    signatureInput: {
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 4,
        height: 60,
        padding: 5,
        justifyContent: 'center',
        alignItems: 'center'
    },
    dateInput: {
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 4,
        padding: 8,
        height: 30, // Approximate height to match label+input visual
        justifyContent: 'center'
    },
    signatureImage: {
        maxWidth: 150,
        maxHeight: 50,
        objectFit: 'contain'
    }
});

// Helper component for table row
const TableRow = ({ label1, value1, label2, value2 }) => (
    <View style={styles.tableRow}>
        <View style={styles.tableColLabel}>
            <Text style={styles.cellTextLabel}>{label1}:</Text>
        </View>
        <View style={styles.tableColValue}>
            <Text style={styles.cellTextValue}>{value1 || '-'}</Text>
        </View>
        <View style={styles.tableColLabel}>
            <Text style={styles.cellTextLabel}>{label2}:</Text>
        </View>
        <View style={styles.tableColValue}>
            <Text style={styles.cellTextValue}>{value2 || '-'}</Text>
        </View>
    </View>
);

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const EnrollmentPDF = ({ data, user }) => {
    // Combine enrollment data with user fallback
    const formData = {
        name: data?.name || user?.name || '',
        college: data?.college || user?.college || '',
        mobileNo: data?.mobileNo || user?.phoneNumber || '',
        currentAddress: data?.currentAddress || user?.currentAddress || '',
        email: data?.email || user?.email || '',
        joiningDate: data?.joiningDate ? formatDate(data.joiningDate) : '',
        preparingFor: data?.preparingFor || user?.preparingFor || '',
        dob: data?.dob ? formatDate(data.dob) : (user?.dateOfBirth ? formatDate(user.dateOfBirth) : ''),
        declarationDate: formatDate(data?.declarationDate || data?.submittedAt),
        signatureUrl: data?.signatureUrl
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Image src={logo} style={styles.logo} />
                    <Text style={styles.title}>Membership Registration Form</Text>
                    <Text style={styles.subtitle}>Mero Reading Room</Text>
                </View>

                {/* Registration Fields Table */}
                <View style={styles.table}>
                    <TableRow
                        label1="Name" value1={formData.name}
                        label2="College" value2={formData.college}
                    />
                    <TableRow
                        label1="Mobile No" value1={formData.mobileNo}
                        label2="Current Address" value2={formData.currentAddress}
                    />
                    <TableRow
                        label1="E-Mail" value1={formData.email}
                        label2="Joining Date" value2={formData.joiningDate}
                    />
                    <TableRow
                        label1="Preparing For" value1={formData.preparingFor}
                        label2="DoB" value2={formData.dob}
                    />
                </View>

                {/* Rules Section */}
                <View style={styles.rulesSection}>
                    <Text style={styles.rulesTitle}>All members should adhere to the following rules and regulations inside the premises</Text>

                    {[
                        "The building is a complete SILENCE ZONE. Mobile phones should be kept in SILENT MODE at all times when inside the building, receiving calls is not permitted in the study room or the common spaces outside the rooms.",
                        "The whole of the building is a NON-SMOKING ZONE. Members may use the garden or canteen area for smoking.",
                        "Side talks and murmurs are strictly prohibited inside the study rooms, members should use the DISCUSSION ROOMS for any such discussions or self study requiring interactions.",
                        "Members are not allowed to eat food items at the study table/inside the building.",
                        "Only members are allowed inside the building. Any third party visitation is strictly prohibited except accompanied by the staff personnel.",
                        "Members shall be allowed a grace period of 3 days for renewal of membership. The payment is non-refundable and non-transferable.",
                        "The office should be informed of any discontinuance of our services else the member shall continue to be charged a membership fee as we continue to keep the seat. The fee shall be payable till the date informed.",
                        "Reading Room reserves the right to inspect bags or other such items when members enter/leave the Reading Room facility. The locker and study table allotted to each member are the responsibility of such individual members and shall be personally liable for damages, including and not limited to, breaking, defacing them, using of pen, marker, non-removable stickers etc. It shall also apply to any other property owned, operated or maintained by Reading Room. Further, the Reading Room shall not be responsible for any goods or items kept therein.",
                        "Reading Room is authorized by the members to post any congratulatory posts/information with photo upon their success in subsequent examinations and life achievements through different online/offline mediums.",
                        "In case of failure to adhere to the aforementioned rules and regulations, the Reading Room reserves the unconditional right to warn and where necessary, terminate the membership without any financial obligations on the Reading Rooms part."
                    ].map((rule, index) => (
                        <View key={index} style={styles.ruleItem}>
                            <Text style={styles.ruleNumber}>{index + 1}.</Text>
                            <Text style={styles.ruleText}>{rule}</Text>
                        </View>
                    ))}
                </View>

                {/* Declaration */}
                <View style={styles.declaration}>
                    <View style={styles.checkbox} />
                    <Text style={styles.declarationText}>
                        I hereby declare that I have read, understood and agree to be bound by the aforementioned rules and regulations.
                    </Text>
                </View>

                {/* Date and Signature */}
                <View style={styles.signatureSection}>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Date:</Text>
                        <View style={styles.dateInput}>
                            <Text style={{ fontSize: 10 }}>{formData.declarationDate}</Text>
                        </View>
                    </View>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Signature:</Text>
                        <View style={styles.signatureInput}>
                            {formData.signatureUrl ? (
                                <Image
                                    src={formData.signatureUrl}
                                    style={styles.signatureImage}
                                />
                            ) : null}
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    );
};

export default EnrollmentPDF;
