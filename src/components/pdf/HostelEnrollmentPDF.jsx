import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import logo from '../../assets/logo.png';

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
        marginBottom: 15
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
    tableColLabelWide: {
        width: "25%",
        borderStyle: "solid",
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        backgroundColor: '#f9fafb',
        padding: 8
    },
    tableColValueWide: {
        width: "75%",
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
    sectionHeader: {
        backgroundColor: '#333',
        padding: '6 12',
        marginBottom: 0,
        marginTop: 10
    },
    sectionHeaderText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    // Guardian table
    guardianTable: {
        display: "flex",
        width: "auto",
        borderStyle: "solid",
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        marginBottom: 15
    },
    guardianHeaderCol1: {
        width: "20%", borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0,
        backgroundColor: '#eee', padding: 6
    },
    guardianHeaderCol2: {
        width: "50%", borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0,
        backgroundColor: '#eee', padding: 6
    },
    guardianHeaderCol3: {
        width: "30%", borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0,
        backgroundColor: '#eee', padding: 6
    },
    guardianCol1: {
        width: "20%", borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, padding: 6
    },
    guardianCol2: {
        width: "50%", borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, padding: 6
    },
    guardianCol3: {
        width: "30%", borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, padding: 6
    },
    guardianAddrLabel: {
        width: "20%", borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0,
        padding: 6, fontWeight: 'bold'
    },
    guardianAddrValue: {
        width: "80%", borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0,
        padding: 6
    },
    photoSection: {
        alignItems: 'center',
        marginBottom: 15
    },
    photo: {
        width: 100,
        height: 120,
        objectFit: 'cover',
        borderWidth: 1,
        borderColor: '#333'
    },
    signatureSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 30,
        marginTop: 15
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
        height: 30,
        justifyContent: 'center'
    },
    signatureImage: {
        maxWidth: 150,
        maxHeight: 50,
        objectFit: 'contain'
    },
    // Rules section
    rulesSection: {
        marginBottom: 20,
        marginTop: 10
    },
    rulesTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 10
    },
    ruleItem: {
        marginBottom: 3,
        flexDirection: 'row',
        fontSize: 8,
        lineHeight: 1.4
    },
    ruleNumber: {
        width: 18,
        fontWeight: 'bold'
    },
    ruleText: {
        flex: 1
    },
    declaration: {
        marginBottom: 15,
        flexDirection: 'row',
        alignItems: 'center'
    },
    checkbox: {
        width: 12,
        height: 12,
        borderWidth: 1,
        borderColor: '#3b82f6',
        marginRight: 10,
        backgroundColor: '#3b82f6'
    },
    declarationText: {
        fontSize: 9,
        fontStyle: 'italic',
        flex: 1
    }
});

const HOSTEL_RULES = [
    "All members should read the rules carefully before signing.",
    "The accommodation is primarily for members; outside visitation is strictly prohibited inside the rooms.",
    "Alcohol, smoking, and drug use inside the building are strictly prohibited. Instant expulsion applies.",
    "Food requests/timing flexibility will not be entertained. Meals are served at fixed times.",
    "Last entry time is 8:30 PM. Gate closes strictly.",
    "Security deposit will be forfeited if rules are breached or minimum stay is not met.",
    "Minimum 1 month notice is required before vacating.",
    "Members reside at their own risk and liability. Management is not responsible for lost valuables.",
    "Breach of non-member entry provision is chargeable by reasonable fine or expulsion.",
    "Room changes require management permission and availability check.",
    "Property damage is the liability of the member and will be deducted from deposit.",
    "Electricity must be used responsibly. Heaters/high-load appliances may be charged extra.",
    "Discipline and silence must be maintained in corridors and common areas.",
    "Management reserves the right to inspect rooms at any reasonable time.",
    "Rent must be paid within the first 5 days of the Nepali month. Late fees apply.",
    "Garbage must be disposed of in designated bins only.",
    "Keys must be returned upon vacating. Lost keys will be charged.",
    "Any medical conditions must be disclosed prior to admission.",
    "Mutual respect among residents and staff is mandatory. Bullying/harassment is zero tolerance.",
    "Water conservation is encouraged. Report leaks immediately.",
    "Internet/Wi-Fi is a facility, not a right. Fair usage policy applies.",
    "Overnight guests are not allowed under any circumstances.",
    "Cooking inside the room is strictly prohibited.",
    "Leave approval must be taken from the warden for overnight absence.",
    "The management decision is final in all disputes."
];

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

const FullWidthRow = ({ label, value }) => (
    <View style={styles.tableRow}>
        <View style={styles.tableColLabelWide}>
            <Text style={styles.cellTextLabel}>{label}:</Text>
        </View>
        <View style={styles.tableColValueWide}>
            <Text style={styles.cellTextValue}>{value || '-'}</Text>
        </View>
    </View>
);

const formatDate = (dateString) => {
    if (!dateString) return '';
    if (typeof dateString === 'object' && dateString.seconds) {
        return new Date(dateString.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (typeof dateString?.toDate === 'function') {
        return dateString.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const HostelEnrollmentPDF = ({ data, user }) => {
    const d = data || {};
    const u = user || {};

    const formData = {
        name: d.name || u.name || '',
        dob: formatDate(d.dob || u.dateOfBirth),
        email: d.email || u.email || '',
        contactNo: d.contactNo || u.phoneNumber || '',
        citizenshipId: d.citizenshipId || '',
        bloodGroup: d.bloodGroup || '',
        profession: d.profession || '',
        college: d.college || u.college || '',
        medicalIssue: d.medicalIssue || '',
        permanentAddress: d.permanentAddress || u.address || '',
        fatherName: d.fatherName || '', fatherContact: d.fatherContact || '',
        motherName: d.motherName || '', motherContact: d.motherContact || '',
        spouseName: d.spouseName || '', spouseContact: d.spouseContact || '',
        localGuardian: d.localGuardian || '', localGuardianContact: d.localGuardianContact || '',
        guardianAddress: d.guardianAddress || '',
        photoUrl: d.photoUrl || u.photoUrl || '',
        declarationDate: formatDate(d.declarationDate || d.submittedAt),
        signatureUrl: d.signatureUrl || '',
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Image src={logo} style={styles.logo} />
                    <Text style={styles.title}>Hostel Admission Form</Text>
                    <Text style={styles.subtitle}>Mero Reading Room & Hostel</Text>
                </View>

                {/* Photo */}
                {formData.photoUrl ? (
                    <View style={styles.photoSection}>
                        <Image src={formData.photoUrl} style={styles.photo} />
                    </View>
                ) : null}

                {/* Personal Information */}
                <View style={styles.table}>
                    <FullWidthRow label="Full Name" value={formData.name} />
                    <TableRow label1="DOB" value1={formData.dob} label2="Blood Group" value2={formData.bloodGroup} />
                    <TableRow label1="Contact No" value1={formData.contactNo} label2="Email" value2={formData.email} />
                    <TableRow label1="Citizenship No" value1={formData.citizenshipId} label2="Profession" value2={formData.profession} />
                    <FullWidthRow label="Institution" value={formData.college} />
                    <FullWidthRow label="Medical Issues" value={formData.medicalIssue} />
                </View>

                {/* Address */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>Address Details</Text>
                </View>
                <View style={styles.table}>
                    <FullWidthRow label="Permanent Address" value={formData.permanentAddress} />
                </View>

                {/* Guardian Information */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>Guardian Information</Text>
                </View>
                <View style={styles.guardianTable}>
                    {/* Guardian header */}
                    <View style={styles.tableRow}>
                        <View style={styles.guardianHeaderCol1}>
                            <Text style={{ ...styles.cellTextLabel }}>Relation</Text>
                        </View>
                        <View style={styles.guardianHeaderCol2}>
                            <Text style={{ ...styles.cellTextLabel }}>Name</Text>
                        </View>
                        <View style={styles.guardianHeaderCol3}>
                            <Text style={{ ...styles.cellTextLabel }}>Contact No.</Text>
                        </View>
                    </View>
                    {/* Guardian rows */}
                    {[
                        { relation: 'Father', name: formData.fatherName, contact: formData.fatherContact },
                        { relation: 'Mother', name: formData.motherName, contact: formData.motherContact },
                        { relation: 'Spouse', name: formData.spouseName, contact: formData.spouseContact },
                        { relation: 'Local Guardian', name: formData.localGuardian, contact: formData.localGuardianContact },
                    ].map((g, i) => (
                        <View key={i} style={styles.tableRow}>
                            <View style={styles.guardianCol1}>
                                <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{g.relation}</Text>
                            </View>
                            <View style={styles.guardianCol2}>
                                <Text style={styles.cellTextValue}>{g.name || '-'}</Text>
                            </View>
                            <View style={styles.guardianCol3}>
                                <Text style={styles.cellTextValue}>{g.contact || '-'}</Text>
                            </View>
                        </View>
                    ))}
                    {/* Guardian Address */}
                    <View style={styles.tableRow}>
                        <View style={styles.guardianAddrLabel}>
                            <Text style={styles.cellTextLabel}>Guardian Address</Text>
                        </View>
                        <View style={styles.guardianAddrValue}>
                            <Text style={styles.cellTextValue}>{formData.guardianAddress || '-'}</Text>
                        </View>
                    </View>
                </View>

                {/* Rules and Regulations */}
                <View style={styles.rulesSection}>
                    <Text style={styles.rulesTitle}>Accommodation Rules and Regulations</Text>
                    {HOSTEL_RULES.map((rule, index) => (
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
                        I hereby declare that all the information provided is true and correct. I have read, understood, and agree to be bound by the rules and regulations of the Reading Room Institute. If found guilty of breach of any rules, I accept the action taken by the management.
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
                                <Image src={formData.signatureUrl} style={styles.signatureImage} />
                            ) : null}
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    );
};

export default HostelEnrollmentPDF;
