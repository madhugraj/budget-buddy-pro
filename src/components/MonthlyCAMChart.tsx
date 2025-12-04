import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface MonthlyCAMData {
    month: string;
    paid_flats: number;
}

interface MonthlyCAMChartProps {
    data: MonthlyCAMData[];
}

export function MonthlyCAMChart({ data }: MonthlyCAMChartProps) {
    return (
        <div className="h-[300px] w-full">
            <div className="mb-4">
                <h3 className="text-lg font-medium">Monthly CAM Collection</h3>
                <p className="text-sm text-muted-foreground">Number of Flats Paid</p>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <XAxis
                        dataKey="month"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        formatter={(value: number) => [value, 'Paid Flats']}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Bar
                        dataKey="paid_flats"
                        name="Paid Flats"
                        fill="#8b5cf6"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
